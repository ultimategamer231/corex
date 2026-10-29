// Corex Admin clients (SPEC-ADMIN.md 4, 8.2, 9.1): LEAD-06 conversion, contract numbers,
// payment milestones, going live and the private documents bucket.
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyActivityLog } from "../src/admin/verify-log.ts";
import { migrateSchema } from "../src/migrations.ts";
import { asAdmin as runAs, asServiceRole, type TestAdmin, verifiedAdmin } from "./admin-helpers.ts";
import { deleteTestUsers, dropSchemas, localKeys, testDb, uniqueSchema } from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("clients");
const users: string[] = [];
let admin: TestAdmin;

const asAdmin = <T>(fn: (tx: TransactionSql) => Promise<T>) => runAs(sql, admin, fn);

async function websiteLead(organization: string, phone = "+231 77 555 0101") {
  const [row] = await asServiceRole(sql, (tx) =>
    tx.unsafe<{ id: string }[]>(
      `insert into ${schema}.leads (name, organization, country, product, phone, message, consent)
       values ('Musu Kollie', $1, 'Liberia', 'clinic', $2, 'Two doctors and forty patients a day.', true)
       returning id`,
      [organization, phone],
    ),
  );
  if (!row) throw new Error("lead not inserted");
  return row.id;
}

const managed = {
  name: "Hope Medical Center",
  country: "Liberia",
  city: "Ganta",
  contact_name: "Comfort Pewee",
  contact_title: "Administrator",
  contact_phone: "+231 88 555 0202",
  contact_email: "admin@hope.example",
  product: "clinic",
  plan: "managed",
  total_minor: 250000,
  currency: "USD",
  signed_on: "2026-09-16",
  milestone_scheme: [50, 30, 20],
  renewal_minor: 60000,
  target_go_live: "2026-11-15",
  hosting_cost_minor: 1000,
  hosting_cost_currency: "USD",
};

async function convert(leadId: string | null, details: Record<string, unknown>) {
  const [row] = await asAdmin((tx) =>
    tx.unsafe<{ id: string }[]>(`select ${schema}.create_client($1, $2::jsonb) as id`, [
      leadId,
      details as never,
    ]),
  );
  if (!row) throw new Error("no client");
  return row.id;
}

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "fatu", users);
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await sql.unsafe(`delete from storage.buckets where id = $1`, [schema]).catch(() => undefined);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("LEAD-06: converting a lead", () => {
  it("creates client, contact, contract, deployment and subscription, and marks the lead Won", async () => {
    const leadId = await websiteLead("Hope Medical Center");
    const clientId = await convert(leadId, managed);

    const [client] = await sql.unsafe(
      `select name, city, source_lead_id from ${schema}.clients where id = $1`,
      [clientId],
    );
    expect(client).toEqual({ name: "Hope Medical Center", city: "Ganta", source_lead_id: leadId });
    const contacts = await sql.unsafe(
      `select name, is_primary, is_billing from ${schema}.client_contacts where client_id = $1`,
      [clientId],
    );
    expect(contacts).toEqual([{ name: "Comfort Pewee", is_primary: true, is_billing: true }]);
    const [contract] = await sql.unsafe<{ number: string; milestone_scheme: number[] }[]>(
      `select number, plan, total_minor::int, milestone_scheme from ${schema}.contracts where client_id = $1`,
      [clientId],
    );
    expect(contract).toMatchObject({
      plan: "managed",
      total_minor: 250000,
      milestone_scheme: [50, 30, 20],
    });
    expect(contract?.number).toMatch(/^CT-26-09-\d{3}$/);
    const [deployment] = await sql.unsafe(
      `select environment, target_go_live::text, hosting_cost_minor_per_month::int as cost
       from ${schema}.deployments where client_id = $1`,
      [clientId],
    );
    expect(deployment).toEqual({ environment: "setup", target_go_live: "2026-11-15", cost: 1000 });
    const [subscription] = await sql.unsafe(
      `select renewal_amount_minor::int as amount, currency, starts_on, next_renewal_on
       from ${schema}.subscriptions where client_id = $1`,
      [clientId],
    );
    expect(subscription).toEqual({
      amount: 60000,
      currency: "USD",
      starts_on: null,
      next_renewal_on: null,
    });
    const [lead] = await sql.unsafe(
      `select stage, converted_client_id from ${schema}.leads where id = $1`,
      [leadId],
    );
    expect(lead).toEqual({ stage: "won", converted_client_id: clientId });
  });

  it("converts a lead only once", async () => {
    const leadId = await websiteLead("Kakata Community School");
    await convert(leadId, { ...managed, name: "Kakata Community School" });
    const count = async () =>
      Number((await sql.unsafe(`select count(*) from ${schema}.clients`))[0]?.count);
    const before = await count();
    await expect(convert(leadId, { ...managed, name: "Kakata Again" })).rejects.toThrow(
      /already converted/,
    );
    expect(await count()).toBe(before);
  });

  it("is all or nothing: a bad contract leaves no client and the lead unchanged", async () => {
    const leadId = await websiteLead("Riverside Traders");
    const count = async () =>
      Number((await sql.unsafe(`select count(*) from ${schema}.clients`))[0]?.count);
    const before = await count();
    await expect(convert(leadId, { ...managed, milestone_scheme: [50, 30] })).rejects.toThrow(
      /milestone_scheme/,
    );
    await expect(convert(leadId, { ...managed, renewal_minor: null })).rejects.toThrow(
      /yearly renewal/,
    );
    expect(await count()).toBe(before);
    const [lead] = await sql.unsafe(
      `select stage, converted_client_id from ${schema}.leads where id = $1`,
      [leadId],
    );
    expect(lead).toEqual({ stage: "new", converted_client_id: null });
  });

  it("Handover clients get no subscription; clients can also be added without a lead", async () => {
    const clientId = await convert(null, {
      ...managed,
      name: "Lakeside Institute",
      product: "school_college",
      plan: "handover",
      renewal_minor: null,
    });
    const subs = await sql.unsafe(`select id from ${schema}.subscriptions where client_id = $1`, [
      clientId,
    ]);
    expect(subs).toHaveLength(0);
  });
});

describe("contract numbers CT-YY-MM-NNN", () => {
  it("count up within a year, restart in the next one and never change", async () => {
    const clientId = await convert(null, {
      ...managed,
      name: "Numbering Test",
      signed_on: "2027-01-05",
    });
    const add = async (signedOn: string) => {
      const [row] = await asAdmin((tx) =>
        tx.unsafe<{ number: string }[]>(
          `insert into ${schema}.contracts (client_id, product, plan, total_minor, currency, signed_on, number)
           values ($1, 'custom', 'handover', 10000, 'USD', $2, 'ignored') returning number`,
          [clientId, signedOn],
        ),
      );
      return row?.number;
    };
    expect(await add("2027-03-02")).toBe("CT-27-03-002");
    expect(await add("2027-12-30")).toBe("CT-27-12-003");
    expect(await add("2028-01-02")).toBe("CT-28-01-001");
    await expect(
      asAdmin((tx) =>
        tx.unsafe(`update ${schema}.contracts set number = 'CT-27-01-999' where client_id = $1`, [
          clientId,
        ]),
      ),
    ).rejects.toThrow(/cannot change/);
  });
});

describe("payment milestones", () => {
  it("split the total half up and give the remainder to the last one", async () => {
    const amounts = async (total: number, scheme: number[]) =>
      (
        await sql.unsafe<{ amount_minor: string }[]>(
          `select amount_minor from ${schema}.milestone_amounts($1, $2::integer[])`,
          [total, scheme],
        )
      ).map((r) => Number(r.amount_minor));
    expect(await amounts(250000, [50, 30, 20])).toEqual([125000, 75000, 50000]);
    expect(await amounts(100001, [50, 30, 20])).toEqual([50001, 30000, 20000]);
    expect(await amounts(1000, [33, 33, 34])).toEqual([330, 330, 340]);
    expect(await amounts(99999, [33, 33, 34])).toEqual([33000, 33000, 33999]);
    expect(await amounts(5, [100])).toEqual([5]);
  });
});

describe("going live", () => {
  it("starts a Managed subscription with the first renewal a year later", async () => {
    const clientId = await convert(null, { ...managed, name: "Bright Future NGO" });
    await asAdmin((tx) =>
      tx.unsafe(
        `update ${schema}.deployments set environment = 'live', went_live_on = '2026-10-17' where client_id = $1`,
        [clientId],
      ),
    );
    const [sub] = await sql.unsafe(
      `select starts_on::text, next_renewal_on::text from ${schema}.subscriptions where client_id = $1`,
      [clientId],
    );
    expect(sub).toEqual({ starts_on: "2026-10-17", next_renewal_on: "2027-10-17" });
  });

  it("gives Handover clients a 60-day warranty from the go-live date", async () => {
    const clientId = await convert(null, {
      ...managed,
      name: "Unity Pharmacy",
      plan: "handover",
      renewal_minor: null,
    });
    await asAdmin((tx) =>
      tx.unsafe(`update ${schema}.deployments set environment = 'live' where client_id = $1`, [
        clientId,
      ]),
    );
    const [deployment] = await sql.unsafe<{ days: number }[]>(
      `select (warranty_ends_on - went_live_on) as days, went_live_on = current_date as today
       from ${schema}.deployments where client_id = $1`,
      [clientId],
    );
    expect(deployment).toEqual({ days: 60, today: true });
  });
});

describe("access and records", () => {
  it("only verified admins see clients; clients are never deleted; the primary contact stays", async () => {
    const clientId = await convert(null, { ...managed, name: "Access Test" });
    const unverified = { userId: admin.userId, sessionId: randomUUID() };
    expect(
      await runAs(sql, unverified, (tx) => tx.unsafe(`select id from ${schema}.clients`)),
    ).toHaveLength(0);
    await expect(
      asAdmin((tx) => tx.unsafe(`delete from ${schema}.clients where id = $1`, [clientId])),
    ).rejects.toThrow(/permission denied/);
    const removed = await asAdmin((tx) =>
      tx.unsafe(`delete from ${schema}.client_contacts where client_id = $1 returning id`, [
        clientId,
      ]),
    );
    expect(removed).toHaveLength(0);
  });

  it("likely duplicates of a lead include client contacts (LEAD-03)", async () => {
    const leadId = await websiteLead("Second Request", "0885550202");
    const rows = await asAdmin((tx) =>
      tx.unsafe<{ organization: string; stage: string; matched_on: string }[]>(
        `select organization, stage, matched_on from ${schema}.lead_duplicates($1, null, $2)`,
        ["0885550202", leadId],
      ),
    );
    expect(rows.some((r) => r.stage === "client" && r.matched_on === "phone")).toBe(true);
  });

  it("has a private bucket that takes only PDF, JPG and PNG up to 10 MB", async () => {
    const [bucket] = await sql.unsafe(
      `select public, file_size_limit::int as limit, allowed_mime_types from storage.buckets where id = $1`,
      [schema],
    );
    expect(bucket).toEqual({
      public: false,
      limit: 10485760,
      allowed_mime_types: ["application/pdf", "image/jpeg", "image/png"],
    });
  });

  it("keeps the activity log verifiable (LOG-02)", async () => {
    const [log] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${schema}.audit_events where table_name in ('clients', 'contracts', 'deployments', 'subscriptions', 'client_contacts')`,
    );
    expect(Number(log?.n)).toBeGreaterThan(10);
    expect((await verifyActivityLog(sql, schema)).ok).toBe(true);
  });
});
