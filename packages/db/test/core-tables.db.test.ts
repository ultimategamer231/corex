import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadMigrations, migrateSchema } from "../src/migrations.ts";
import { dropSchemas, testDb, uniqueSchema } from "./helpers.ts";

const sql = testDb();
const schema = uniqueSchema("core");

beforeAll(async () => {
  await migrateSchema(sql, schema, "school");
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await sql.end();
});

// SPEC.md 5.1 key columns, in order. Extra columns (created_at, checks) are allowed after them.
const spec: Record<string, string[]> = {
  settings: [
    "org_name",
    "logo_path",
    "address",
    "phone",
    "email",
    "letterhead_text",
    "base_currency",
    "enabled_currencies",
    "timezone",
    "config",
  ],
  memberships: ["user_id", "role", "status", "display_name", "created_at"],
  audit_events: [
    "id",
    "actor_id",
    "action",
    "table_name",
    "record_id",
    "before",
    "after",
    "reason",
    "created_at",
  ],
  files: [
    "id",
    "bucket_path",
    "owner_table",
    "owner_id",
    "mime_type",
    "size_bytes",
    "uploaded_by",
    "created_at",
  ],
  announcements: [
    "id",
    "title",
    "body",
    "audience_roles",
    "audience_filter",
    "created_by",
    "published_at",
  ],
  invoices: [
    "id",
    "number",
    "party_type",
    "party_id",
    "currency",
    "status",
    "issue_date",
    "due_date",
    "notes",
    "created_by",
  ],
  invoice_lines: [
    "id",
    "invoice_id",
    "description",
    "quantity",
    "unit_amount_minor",
    "amount_minor",
  ],
  payments: [
    "id",
    "invoice_id",
    "amount_minor",
    "currency",
    "method",
    "reference",
    "received_at",
    "received_by",
    "status",
    "void_reason",
  ],
  receipts: ["id", "number", "payment_id", "issued_at"],
};

describe("core tables (SPEC.md 5.1)", () => {
  it("loads the real core migrations in order", () => {
    const ids = loadMigrations("school").map((m) => m.id);
    expect(ids[0]).toBe("core/0001_core_tables");
  });

  it.each(Object.entries(spec))("%s has the specified columns", async (table, columns) => {
    const rows = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = ${schema} and table_name = ${table}`;
    const actual = rows.map((r) => r.column_name);
    for (const column of columns) expect(actual).toContain(column);
  });

  it("enables row-level security on every table", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = ${schema} and c.relkind = 'r'`;
    expect(rows.length).toBeGreaterThanOrEqual(Object.keys(spec).length + 1);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it("stores money as bigint minor units with a currency (CORE-04)", async () => {
    const rows = await sql<{ table_name: string; column_name: string; data_type: string }[]>`
      select table_name, column_name, data_type from information_schema.columns
      where table_schema = ${schema} and column_name like '%amount%'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows)
      expect(row.data_type, `${row.table_name}.${row.column_name}`).toBe("bigint");
    const floats = await sql`
      select table_name, column_name from information_schema.columns
      where table_schema = ${schema} and data_type in ('real', 'double precision', 'money')`;
    expect(floats).toEqual([]);
  });

  it("uses UUID primary keys that a client can supply (CORE-06)", async () => {
    const id = crypto.randomUUID();
    await sql.unsafe(
      `insert into ${schema}.announcements (id, title, body) values ($1, 'Hi', 'x')`,
      [id],
    );
    await sql.unsafe(
      `insert into ${schema}.announcements (id, title, body) values ($1, 'Hi', 'x') on conflict (id) do nothing`,
      [id],
    );
    const [row] = await sql.unsafe<{ count: string }[]>(
      `select count(*) from ${schema}.announcements where id = $1`,
      [id],
    );
    expect(Number(row?.count)).toBe(1);
  });

  it("allows only one settings row and only USD or LRD", async () => {
    await sql.unsafe(`insert into ${schema}.settings (org_name) values ('Sample College')`);
    await expect(
      sql.unsafe(`insert into ${schema}.settings (org_name) values ('Second')`),
    ).rejects.toThrow();
    await expect(
      sql.unsafe(`update ${schema}.settings set base_currency = 'EUR'`),
    ).rejects.toThrow();
    await expect(
      sql.unsafe(
        `update ${schema}.settings set enabled_currencies = array['USD'], base_currency = 'LRD'`,
      ),
    ).rejects.toThrow();
  });

  it("requires a reason to void a payment (CORE-07)", async () => {
    const invoice = crypto.randomUUID();
    await sql.unsafe(
      `insert into ${schema}.invoices (id, party_type, party_id, currency) values ($1, 'student', gen_random_uuid(), 'LRD')`,
      [invoice],
    );
    await expect(
      sql.unsafe(
        `insert into ${schema}.payments (invoice_id, amount_minor, currency, method, status) values ($1, 500, 'LRD', 'cash', 'void')`,
        [invoice],
      ),
    ).rejects.toThrow();
    await expect(
      sql.unsafe(
        `insert into ${schema}.payments (invoice_id, amount_minor, currency, method) values ($1, 0, 'LRD', 'cash')`,
        [invoice],
      ),
    ).rejects.toThrow();
  });
});
