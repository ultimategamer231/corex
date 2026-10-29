// Corex Admin leads (SPEC-ADMIN.md 8.1): LEAD-01 to LEAD-05 at the database.
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyActivityLog } from "../src/admin/verify-log.ts";
import { migrateSchema } from "../src/migrations.ts";
import { asServiceRole, type TestAdmin, verifiedAdmin, asAdmin as runAs } from "./admin-helpers.ts";
import { deleteTestUsers, dropSchemas, localKeys, testDb, uniqueSchema } from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("leads");
const users: string[] = [];
let admin: TestAdmin;
let other: TestAdmin;

const asAdmin = <T>(
  who: { userId: string; sessionId: string },
  fn: (tx: TransactionSql) => Promise<T>,
) => runAs(sql, who, fn);

/** The website server: service role, no admin named. */
const asWebsite = <T>(fn: (tx: TransactionSql) => Promise<T>) => asServiceRole(sql, fn);

async function websiteLead(phone = "+231 77 123 4567", email: string | null = null) {
  const [row] = await asWebsite((tx) =>
    tx.unsafe<{ id: string }[]>(
      `insert into ${schema}.leads (name, organization, country, product, plan_interest, phone, email, message, consent, source_page)
       values ('Joseph Wleh', 'St. Peter''s College', 'Liberia', 'school-college', 'handover', $1, $2,
               'We have about 900 students across 4 programs.', true, '/software/school')
       returning id`,
      [phone, email],
    ),
  );
  if (!row) throw new Error("lead not inserted");
  return row.id;
}

async function timeline(leadId: string) {
  return sql.unsafe<{ type: string; body: string; admin_id: string | null }[]>(
    `select type, body, admin_id from ${schema}.lead_activities where lead_id = $1 order by created_at, id`,
    [leadId],
  );
}

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "fatu", users);
  other = await verifiedAdmin(sql, keys, schema, "maima", users);
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("LEAD-01: website requests", () => {
  it("arrive as stage new, source website, with a form entry and a website log entry", async () => {
    const id = await websiteLead();
    const [lead] = await sql.unsafe<{ stage: string; source: string }[]>(
      `select stage, source from ${schema}.leads where id = $1`,
      [id],
    );
    expect(lead).toEqual({ stage: "new", source: "website" });
    expect(await timeline(id)).toEqual([
      {
        type: "form",
        body: "Quote request submitted on the website (/software/school).",
        admin_id: null,
      },
    ]);
    const [log] = await sql.unsafe<{ actor_type: string; area: string; summary: string }[]>(
      `select actor_type, area, summary from ${schema}.audit_events
       where table_name = 'leads' and record_id = $1 and action = 'create'`,
      [id],
    );
    expect(log).toEqual({
      actor_type: "website",
      area: "leads",
      summary: "Website quote request from St. Peter's College",
    });
  });

  it("keep every original field read-only, for admins and the service role", async () => {
    const id = await websiteLead();
    for (const change of [
      "name = 'Someone Else'",
      "phone = '+231 88 000 0000'",
      "message = 'Changed message text'",
      "product = 'clinic'",
      "source = 'manual'",
    ]) {
      await expect(
        asAdmin(admin, (tx) =>
          tx.unsafe(`update ${schema}.leads set ${change} where id = $1`, [id]),
        ),
      ).rejects.toThrow(/cannot be changed|cannot change/);
    }
    await expect(
      asWebsite((tx) =>
        tx.unsafe(`update ${schema}.leads set organization = 'Other' where id = $1`, [id]),
      ),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("can be worked: stage, assignment, follow-up and next step", async () => {
    const id = await websiteLead();
    await asAdmin(admin, (tx) =>
      tx.unsafe(
        `update ${schema}.leads
         set stage = 'contacted', assigned_admin_id = $2, follow_up_on = '2026-11-03', next_step = 'Book a demo'
         where id = $1`,
        [id, other.adminId],
      ),
    );
    const [lead] = await sql.unsafe<{ stage: string; assigned_admin_id: string }[]>(
      `select stage, assigned_admin_id from ${schema}.leads where id = $1`,
      [id],
    );
    expect(lead).toEqual({ stage: "contacted", assigned_admin_id: other.adminId });
  });

  it("cannot be added by an admin as if from the website, and are never deleted", async () => {
    await expect(
      asAdmin(admin, (tx) =>
        tx.unsafe(
          `insert into ${schema}.leads (name, organization, phone, source) values ('A Person', 'Some Org', '0770000000', 'website')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const id = await websiteLead();
    await expect(
      asWebsite((tx) => tx.unsafe(`delete from ${schema}.leads where id = $1`, [id])),
    ).rejects.toThrow(/never deleted/);
  });
});

describe("LEAD-02: leads added by hand", () => {
  it("need a name, an organization and a phone or email", async () => {
    const add = (values: string) =>
      asAdmin(admin, (tx) =>
        tx.unsafe(
          `insert into ${schema}.leads (name, organization, phone, email, source) values (${values}, 'manual') returning id, stage`,
        ),
      );
    await expect(add("'Ibrahim Konneh', 'Mano River Logistics', null, null")).rejects.toThrow(
      /leads_contact_check/,
    );
    await expect(add("'I', 'Mano River Logistics', '0770000000', null")).rejects.toThrow();
    await expect(add("'Ibrahim Konneh', '', null, 'ik@example.com'")).rejects.toThrow();
    const [byEmail] = await add("'Ibrahim Konneh', 'Mano River Logistics', null, 'ik@example.com'");
    expect(byEmail?.stage).toBe("new");
    const [byPhone] = await add("'Grace Flomo', 'Unity Pharmacy', '0886 111 222', null");
    expect(byPhone).toBeDefined();
  });

  it("are logged as the admin who added them, and nobody unverified sees leads", async () => {
    const [row] = await asAdmin(admin, (tx) =>
      tx.unsafe<{ id: string }[]>(
        `insert into ${schema}.leads (name, organization, email, source) values ('Samuel Gaye', 'Coastal View Hotel', 'sg@example.com', 'manual') returning id`,
      ),
    );
    const [log] = await sql.unsafe<{ actor_id: string; actor_type: string; summary: string }[]>(
      `select actor_id, actor_type, summary from ${schema}.audit_events where table_name = 'leads' and record_id = $1`,
      [row?.id ?? null],
    );
    expect(log).toEqual({
      actor_id: admin.userId,
      actor_type: "admin",
      summary: "Added lead Coastal View Hotel",
    });
    const unverified = { userId: admin.userId, sessionId: randomUUID() };
    const visible = await asAdmin(unverified, (tx) => tx.unsafe(`select id from ${schema}.leads`));
    expect(visible).toHaveLength(0);
  });
});

describe("LEAD-03: likely duplicates", () => {
  it("match the same phone in another format, or the same email in any case", async () => {
    const first = await websiteLead("+231 88 555 0101", "Registrar@Example.org");
    const second = await websiteLead("0885550101");
    const byPhone = await asAdmin(admin, (tx) =>
      tx.unsafe<{ id: string; matched_on: string }[]>(
        `select id, matched_on from ${schema}.lead_duplicates($1, null, $2)`,
        ["0885550101", second],
      ),
    );
    expect(byPhone).toEqual([{ id: first, matched_on: "phone" }]);
    const byEmail = await asAdmin(admin, (tx) =>
      tx.unsafe<{ id: string; matched_on: string }[]>(
        `select id, matched_on from ${schema}.lead_duplicates(null, $1, null)`,
        [" registrar@example.org "],
      ),
    );
    expect(byEmail).toEqual([{ id: first, matched_on: "email" }]);
    const none = await asAdmin(admin, (tx) =>
      tx.unsafe(`select id from ${schema}.lead_duplicates('12', '', null)`),
    );
    expect(none).toHaveLength(0);
  });
});

describe("LEAD-04: stage changes", () => {
  it("need a reason for lost, and each one adds a stage_change entry by the admin", async () => {
    const id = await websiteLead();
    await expect(
      asAdmin(admin, (tx) =>
        tx.unsafe(`update ${schema}.leads set stage = 'lost' where id = $1`, [id]),
      ),
    ).rejects.toThrow(/leads_lost_needs_reason/);
    await asAdmin(admin, (tx) =>
      tx.unsafe(`update ${schema}.leads set stage = 'contacted' where id = $1`, [id]),
    );
    await asAdmin(other, (tx) =>
      tx.unsafe(
        `update ${schema}.leads set stage = 'lost', lost_reason = 'Chose another supplier' where id = $1`,
        [id],
      ),
    );
    await asAdmin(admin, (tx) =>
      tx.unsafe(`update ${schema}.leads set stage = 'quoted' where id = $1`, [id]),
    );
    const entries = (await timeline(id)).filter((e) => e.type === "stage_change");
    expect(entries).toEqual([
      {
        type: "stage_change",
        body: "Stage changed from New to Contacted.",
        admin_id: admin.adminId,
      },
      {
        type: "stage_change",
        body: "Stage changed from Contacted to Lost. Reason: Chose another supplier.",
        admin_id: other.adminId,
      },
      { type: "stage_change", body: "Stage changed from Lost to Quoted.", admin_id: admin.adminId },
    ]);
    const [lead] = await sql.unsafe<{ lost_reason: string | null }[]>(
      `select lost_reason from ${schema}.leads where id = $1`,
      [id],
    );
    expect(lead?.lost_reason).toBeNull();
  });

  it("a quote adds a quote entry; amount and currency go together", async () => {
    const id = await websiteLead();
    await expect(
      asAdmin(admin, (tx) =>
        tx.unsafe(`update ${schema}.leads set quote_amount_minor = 400000 where id = $1`, [id]),
      ),
    ).rejects.toThrow(/leads_quote_pair/);
    await asAdmin(admin, (tx) =>
      tx.unsafe(
        `update ${schema}.leads
         set quote_amount_minor = 400000, quote_currency = 'USD', quote_sent_on = '2026-10-27',
             quote_note = 'College edition, Handover plan', stage = 'quoted'
         where id = $1`,
        [id],
      ),
    );
    const bodies = (await timeline(id)).map((e) => e.body);
    expect(bodies).toContain(
      "Quote sent 27 Oct 2026: US$4,000.00. College edition, Handover plan.",
    );
    expect(bodies).toContain("Stage changed from New to Quoted.");
  });
});

describe("LEAD-05: notes and activities are append-only", () => {
  it("admins add entries signed with their own name, and cannot change or remove any", async () => {
    const id = await websiteLead();
    const [entry] = await asAdmin(admin, (tx) =>
      tx.unsafe<{ id: string; admin_id: string }[]>(
        `insert into ${schema}.lead_activities (lead_id, type, body, admin_id)
         values ($1, 'call', 'First call. 900 students.', $2) returning id, admin_id`,
        [id, other.adminId],
      ),
    );
    expect(entry?.admin_id).toBe(admin.adminId);
    const entryId = entry?.id ?? null;
    await expect(
      asAdmin(admin, (tx) =>
        tx.unsafe(
          `insert into ${schema}.lead_activities (lead_id, type, body) values ($1, 'stage_change', 'Fake')`,
          [id],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asAdmin(admin, (tx) =>
        tx.unsafe(`update ${schema}.lead_activities set body = 'Edited' where id = $1`, [entryId]),
      ),
    ).rejects.toThrow(/permission denied/);
    for (const statement of [
      `update ${schema}.lead_activities set body = 'Edited' where id = $1`,
      `delete from ${schema}.lead_activities where id = $1`,
    ]) {
      await expect(asWebsite((tx) => tx.unsafe(statement, [entryId]))).rejects.toThrow(
        /cannot be changed or removed/,
      );
    }
  });
});

describe("activity log", () => {
  it("still verifies after all lead changes (LOG-02)", async () => {
    const result = await verifyActivityLog(sql, schema);
    expect(result.ok).toBe(true);
  });
});
