import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import {
  asUser,
  createTestUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
  uniqueSchema,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("audit");
let admin = "";
let member = "";

type AuditRow = {
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
};

async function auditFor(recordId: string): Promise<AuditRow[]> {
  return sql.unsafe<AuditRow[]>(
    `select actor_id, action, table_name, record_id, before, after, reason
     from ${schema}.audit_events where record_id = $1 order by created_at, action`,
    [recordId],
  );
}

beforeAll(async () => {
  await migrateSchema(sql, schema, "finance");
  admin = await createTestUser(keys, testEmail("owner"), "Test@2026pass");
  member = await createTestUser(keys, testEmail("staff"), "Test@2026pass");
  await sql.unsafe(
    `insert into ${schema}.memberships (user_id, role, display_name) values ($1, 'owner', 'Owner'), ($2, 'staff', 'Staff')`,
    [admin, member],
  );
  await sql.unsafe(`insert into ${schema}.settings (org_name) values ('Sample Trading Ltd')`);
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, admin, member);
  await sql.end();
});

describe("audit trigger (CORE-03)", () => {
  it("records create, update and void with the acting user", async () => {
    const invoice = crypto.randomUUID();
    const payment = crypto.randomUUID();
    await sql.unsafe(
      `insert into ${schema}.invoices (id, party_type, party_id, currency) values ($1, 'counterparty', gen_random_uuid(), 'USD')`,
      [invoice],
    );
    await sql.unsafe(
      `insert into ${schema}.payments (id, invoice_id, amount_minor, currency, method) values ($1, $2, 2500, 'USD', 'cash')`,
      [payment, invoice],
    );
    // A billing-role policy arrives with the products; here the owner acts through a temporary policy.
    await sql.unsafe(
      `create policy test_owner_update on ${schema}.payments for update to authenticated using (${schema}.is_admin()) with check (${schema}.is_admin())`,
    );
    await asUser(sql, admin, (tx) =>
      tx.unsafe(`update ${schema}.payments set reference = 'MM-123' where id = $1`, [payment]),
    );
    await asUser(sql, admin, (tx) =>
      tx.unsafe(
        `update ${schema}.payments set status = 'void', void_reason = 'Duplicate entry' where id = $1`,
        [payment],
      ),
    );

    const rows = await auditFor(payment);
    expect(rows.map((r) => r.action)).toEqual(["create", "update", "void"]);
    expect(rows[0]?.actor_id).toBeNull(); // inserted by the migration/service connection, no JWT
    expect(rows[1]?.actor_id).toBe(admin);
    expect(rows[2]).toMatchObject({
      actor_id: admin,
      table_name: "payments",
      reason: "Duplicate entry",
    });
    expect(rows[2]?.before).toMatchObject({ status: "posted" });
    expect(rows[2]?.after).toMatchObject({ status: "void" });
  });

  it("records approvals as approve", async () => {
    const tableSql = `
      create table ${schema}.test_grades (id uuid primary key default gen_random_uuid(), status text not null default 'draft');
      select ${schema}.enable_audit('${schema}.test_grades');`;
    await sql.unsafe(tableSql);
    const id = crypto.randomUUID();
    await sql.unsafe(`insert into ${schema}.test_grades (id) values ($1)`, [id]);
    await sql.unsafe(`update ${schema}.test_grades set status = 'submitted' where id = $1`, [id]);
    await sql.unsafe(`update ${schema}.test_grades set status = 'approved' where id = $1`, [id]);
    expect((await auditFor(id)).map((r) => r.action)).toEqual(["create", "update", "approve"]);
  });

  it("records deletes and a reason set by server code", async () => {
    const id = crypto.randomUUID();
    await sql.unsafe(
      `insert into ${schema}.announcements (id, title, body) values ($1, 'Closed Friday', 'x')`,
      [id],
    );
    await sql.begin(async (tx) => {
      await tx`select set_config('corex.audit_reason', 'Posted by mistake', true)`;
      await tx.unsafe(`delete from ${schema}.announcements where id = $1`, [id]);
    });
    const rows = await auditFor(id);
    expect(rows.map((r) => r.action)).toEqual(["create", "delete"]);
    expect(rows[1]).toMatchObject({ reason: "Posted by mistake", after: null });
    expect(rows[1]?.before).toMatchObject({ title: "Closed Friday" });
  });

  it("skips updates that change nothing", async () => {
    const id = crypto.randomUUID();
    await sql.unsafe(
      `insert into ${schema}.announcements (id, title, body) values ($1, 'Same', 'x')`,
      [id],
    );
    await sql.unsafe(`update ${schema}.announcements set title = 'Same' where id = $1`, [id]);
    expect((await auditFor(id)).map((r) => r.action)).toEqual(["create"]);
  });

  it("audits settings and membership changes", async () => {
    await asUser(sql, admin, (tx) =>
      tx.unsafe(`update ${schema}.settings set phone = '+231 777 000 000'`),
    );
    const [settingsRow] = await sql.unsafe<AuditRow[]>(
      `select actor_id, action from ${schema}.audit_events where table_name = 'settings' and action = 'update'`,
    );
    expect(settingsRow).toMatchObject({ actor_id: admin, action: "update" });
    const membershipRows = await auditFor(member);
    expect(membershipRows.map((r) => r.action)).toContain("create");
  });
});

describe("audit log protection", () => {
  it("cannot be edited or deleted, even by the database owner", async () => {
    await expect(sql.unsafe(`update ${schema}.audit_events set reason = 'x'`)).rejects.toThrow(
      /append-only/,
    );
    await expect(sql.unsafe(`delete from ${schema}.audit_events`)).rejects.toThrow(/append-only/);
  });

  it("cannot be written directly by app users", async () => {
    await expect(
      asUser(sql, admin, (tx) =>
        tx.unsafe(
          `insert into ${schema}.audit_events (action, table_name) values ('create', 'fake')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("is readable by administrators only", async () => {
    const asAdmin = await asUser(sql, admin, (tx) =>
      tx.unsafe(`select id from ${schema}.audit_events`),
    );
    expect(asAdmin.length).toBeGreaterThan(0);
    const asStaff = await asUser(sql, member, (tx) =>
      tx.unsafe(`select id from ${schema}.audit_events`),
    );
    expect(asStaff).toHaveLength(0);
  });

  it("logs record views for members only (CLN-02 groundwork)", async () => {
    const record = crypto.randomUUID();
    await asUser(sql, member, (tx) =>
      tx.unsafe(`select ${schema}.log_view('patients', $1)`, [record]),
    );
    expect(await auditFor(record)).toEqual([
      expect.objectContaining({ action: "view", actor_id: member, table_name: "patients" }),
    ]);
    const outsider = await createTestUser(keys, testEmail("outsider"), "Test@2026pass");
    try {
      await expect(
        asUser(sql, outsider, (tx) =>
          tx.unsafe(`select ${schema}.log_view('patients', $1)`, [record]),
        ),
      ).rejects.toThrow(/not a member/);
    } finally {
      await deleteTestUsers(keys, outsider);
    }
  });
});
