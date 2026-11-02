// Corex Admin data is backed up and restored like a client schema (SPEC-ADMIN.md 14, A6):
// a round trip keeps clients, invoices, payments and receipts, and the activity log's
// hash chain still verifies afterwards.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyActivityLog } from "../src/admin/verify-log.ts";
import { backupSchema, restoreSchema } from "../src/backup.ts";
import { LOCAL_DATABASE_URL } from "../src/env.ts";
import { migrateSchema } from "../src/migrations.ts";
import { supabaseAdmin } from "../src/supabase-admin.ts";
import { asServiceRole } from "./admin-helpers.ts";
import {
  asUser,
  createTestUser,
  deleteTestBuckets,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  localS3,
  testDb,
  testEmail,
  uniqueSchema,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("adminbak");
const bucket = uniqueSchema("adminbackups").replaceAll("_", "-");
const storage = localS3(bucket);
const databaseUrl = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
let outsider = "";

async function counts() {
  const [row] = await sql.unsafe<Record<string, string>[]>(
    `select (select count(*) from ${schema}.clients) as clients,
            (select count(*) from ${schema}.invoices) as invoices,
            (select count(*) from ${schema}.payments) as payments,
            (select count(*) from ${schema}.receipts) as receipts,
            (select count(*) from ${schema}.leads) as leads,
            (select count(*) from ${schema}.audit_events) as events`,
  );
  return row;
}

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  const admin = supabaseAdmin({ url: keys.apiUrl, serviceRoleKey: keys.serviceRoleKey });
  const { error } = await admin.storage.createBucket(bucket, { public: false });
  if (error) throw error;
  outsider = await createTestUser(keys, testEmail("adminbak"), "Outsider-Test-2026!");

  // A client with a sent, part-paid milestone invoice, written as the app would.
  const [client] = await sql.unsafe<{ id: string }[]>(
    `select ${schema}.create_client(null, $1::jsonb) as id`,
    [
      {
        name: "Hope Medical Center",
        contact_name: "Esther Dolo",
        contact_phone: "+231 88 555 0601",
        product: "clinic",
        plan: "managed",
        total_minor: 250000,
        currency: "USD",
        signed_on: "2026-09-16",
        milestone_scheme: [50, 30, 20],
        renewal_minor: 60000,
      } as never,
    ],
  );
  const [contract] = await sql.unsafe<{ id: string }[]>(
    `select id from ${schema}.contracts where client_id = $1`,
    [client?.id ?? ""],
  );
  const [invoice] = await sql.unsafe<{ id: string }[]>(
    `select ${schema}.save_invoice_draft(null, $1::jsonb) as id`,
    [
      {
        client_id: client?.id,
        kind: "milestone",
        contract_id: contract?.id,
        milestone_no: 1,
        currency: "USD",
        discount_type: "percent",
        discount_value: 10,
        lines: [{ description: "Milestone 1 of 3 (50%)", quantity: 1, unit_amount_minor: 125000 }],
      } as never,
    ],
  );
  await sql.unsafe(`select ${schema}.issue_invoice($1)`, [invoice?.id ?? ""]);
  await sql.unsafe(
    `select * from ${schema}.record_payment(gen_random_uuid(), $1, 50000, 'USD', 'mtn_momo', 'MM-1')`,
    [invoice?.id ?? ""],
  );
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await sql.unsafe(`delete from storage.buckets where id = $1`, [schema]).catch(() => undefined);
  await deleteTestBuckets(keys, bucket);
  await deleteTestUsers(keys, outsider);
  await sql.end();
});

describe("backing up and restoring Corex Admin data", () => {
  it("restores clients, invoices and payments, and the activity log still verifies", async () => {
    expect((await verifyActivityLog(sql, schema)).ok).toBe(true);
    const before = await counts();
    await backupSchema({ databaseUrl, schema, project: "local", storage });

    // A website request that arrives after the backup is not in it.
    await asServiceRole(sql, (tx) =>
      tx.unsafe(
        `insert into ${schema}.leads (name, organization, country, product, phone, message, consent)
         values ('Musu Kollie', 'Greenfield Academy', 'Liberia', 'clinic', '+231 77 555 0101', 'Report cards.', true)`,
      ),
    );
    expect(Number((await counts())?.leads)).toBe(Number(before?.leads) + 1);

    await restoreSchema({ databaseUrl, schema, project: "local", storage });
    expect(await counts()).toEqual(before);
    const result = await verifyActivityLog(sql, schema);
    expect(result).toMatchObject({ ok: true });
    const [invoice] = await sql.unsafe<{ display_number: string; status: string }[]>(
      `select display_number, status from ${schema}.invoices`,
    );
    expect(invoice).toMatchObject({ status: "partially_paid" });
    expect(invoice?.display_number).toMatch(/^CX-\d{2}-\d{2}-001$/);
  });

  it("keeps row-level security and the permanent-record guards after a restore", async () => {
    const rows = await asUser(sql, outsider, (tx) => tx.unsafe(`select * from ${schema}.invoices`));
    expect(rows).toHaveLength(0);
    await expect(sql.unsafe(`delete from ${schema}.payments`)).rejects.toThrow(/never deleted/);
    await expect(sql.unsafe(`delete from ${schema}.audit_events`)).rejects.toThrow();
  });
});
