// Quote request retention (audit round F5): a lead never converted to a client, with no
// contact for a year, is deleted with its timeline by the daily job; nobody else can
// delete a lead, even by setting the setting the purge uses.
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import { asAdmin as runAs, asServiceRole, type TestAdmin, verifiedAdmin } from "./admin-helpers.ts";
import { deleteTestUsers, dropSchemas, localKeys, testDb, uniqueSchema } from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("retain");
const users: string[] = [];
let admin: TestAdmin;

const asAdmin = <T>(fn: (tx: TransactionSql) => Promise<T>) => runAs(sql, admin, fn);

async function websiteLead(organization: string): Promise<string> {
  const [row] = await asServiceRole(sql, (tx) =>
    tx.unsafe<{ id: string }[]>(
      `insert into ${schema}.leads (name, organization, country, product, phone, message, consent)
       values ('Musu Kollie', $1, 'Liberia', 'clinic', '+231 77 555 0101', 'We need a clinic system.', true)
       returning id`,
      [organization],
    ),
  );
  return row?.id ?? "";
}

async function leadIds(): Promise<string[]> {
  const rows = await sql.unsafe<{ organization: string }[]>(
    `select organization from ${schema}.leads order by organization`,
  );
  return rows.map((r) => r.organization);
}

const purge = (before: Date) =>
  asServiceRole(sql, (tx) =>
    tx.unsafe<{ n: number }[]>(`select ${schema}.purge_stale_leads($1) as n`, [before]),
  );

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "retain", users);
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("quote request retention", () => {
  it("deletes only requests with no contact since the cut-off and never a client's", async () => {
    await websiteLead("A Stale Clinic");
    const noted = await websiteLead("B Noted Clinic");
    const converted = await websiteLead("C Converted Clinic");
    await asAdmin((tx) =>
      tx.unsafe(`select ${schema}.create_client($1, $2::jsonb)`, [
        converted,
        {
          name: "C Converted Clinic",
          contact_name: "Musu Kollie",
          contact_phone: "+231 77 555 0101",
          product: "clinic",
          plan: "managed",
          total_minor: 250000,
          currency: "USD",
          signed_on: "2026-01-10",
          milestone_scheme: [70, 30],
          renewal_minor: 60000,
        } as never,
      ]),
    );
    await new Promise((r) => setTimeout(r, 50));
    const [cut] = await sql.unsafe<{ t: Date }[]>(`select clock_timestamp() as t`);
    await new Promise((r) => setTimeout(r, 50));
    await asAdmin((tx) =>
      tx.unsafe(
        `insert into ${schema}.lead_activities (lead_id, type, body) values ($1, 'call', 'Called back')`,
        [noted],
      ),
    );
    await websiteLead("D New Clinic");

    const [result] = await purge(cut?.t ?? new Date());
    expect(result?.n).toBe(1);
    expect(await leadIds()).toEqual(["B Noted Clinic", "C Converted Clinic", "D New Clinic"]);
    const [left] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${schema}.lead_activities a
       where not exists (select 1 from ${schema}.leads l where l.id = a.lead_id)`,
    );
    expect(Number(left?.n)).toBe(0);
    // The activity log keeps the record of the deleted request.
    const [logged] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${schema}.audit_events
       where table_name = 'leads' and action = 'delete'`,
    );
    expect(Number(logged?.n)).toBe(1);
    // Running again deletes nothing more.
    expect((await purge(cut?.t ?? new Date()))[0]?.n).toBe(0);
  });

  it("is only for the server, and the setting it uses does not let anyone else delete", async () => {
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.purge_stale_leads(now())`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asServiceRole(sql, async (tx) => {
        await tx.unsafe(`select set_config('corex.retention', 'on', true)`);
        await tx.unsafe(`delete from ${schema}.lead_activities`);
      }),
    ).rejects.toThrow(/cannot be changed or removed/);
    await expect(
      asServiceRole(sql, async (tx) => {
        await tx.unsafe(`select set_config('corex.retention', 'on', true)`);
        await tx.unsafe(`delete from ${schema}.leads where organization = 'D New Clinic'`);
      }),
    ).rejects.toThrow(/never deleted/);
  });
});
