// Corex Admin system status (audit round A3): results are written only by the server,
// read only by admins, kept 30 days, and a change of state (down, back up) is reported.
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import { asAdmin as runAs, asServiceRole, type TestAdmin, verifiedAdmin } from "./admin-helpers.ts";
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
const schema = uniqueSchema("status");
const users: string[] = [];
let admin: TestAdmin;
let outsider: string;

const asAdmin = <T>(fn: (tx: TransactionSql) => Promise<T>) => runAs(sql, admin, fn);

type Change = { target: string; url: string; ok: boolean; error: string | null; was_ok: boolean };

const SITE = "https://www.example.org";
const DEMO = "https://demo.example.org";

async function record(checks: Record<string, unknown>[]): Promise<Change[]> {
  return asServiceRole(sql, (tx) =>
    tx.unsafe<Change[]>(`select * from ${schema}.record_status_checks($1::jsonb)`, [
      checks as never,
    ]),
  );
}

const check = (url: string, ok: boolean, extra: Record<string, unknown> = {}) => ({
  target: url === SITE ? "Website" : "Demo",
  url,
  ok,
  status_code: ok ? 200 : 503,
  response_ms: 120,
  error: ok ? null : "Service unavailable",
  ...extra,
});

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "status", users);
  outsider = await createTestUser(keys, testEmail("status-outsider"), "Outsider-Test-2026!");
  users.push(outsider);
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("system status", () => {
  it("reports only changes of state, against each address's previous check", async () => {
    expect(await record([check(SITE, true), check(DEMO, true)])).toEqual([]);
    expect(await record([check(SITE, true), check(DEMO, false)])).toEqual([
      { target: "Demo", url: DEMO, ok: false, error: "Service unavailable", was_ok: true },
    ]);
    // Still down: no second alert.
    expect(await record([check(SITE, true), check(DEMO, false)])).toEqual([]);
    const back = await record([check(SITE, true), check(DEMO, true)]);
    expect(back.map((c) => [c.url, c.ok, c.was_ok])).toEqual([[DEMO, true, false]]);
  });

  it("gives admins each address's latest result, uptime and when it went down", async () => {
    await record([check(DEMO, false)]);
    const rows = await asAdmin((tx) =>
      tx.unsafe<{ url: string; ok: boolean; up_24h: string; down_since: Date | null }[]>(
        `select url, ok, up_24h, down_since from ${schema}.status_overview()`,
      ),
    );
    // Down systems come first.
    expect(rows.map((r) => [r.url, r.ok])).toEqual([
      [DEMO, false],
      [SITE, true],
    ]);
    expect(Number(rows[0]?.up_24h)).toBe(40);
    expect(rows[0]?.down_since).toBeInstanceOf(Date);
    expect(Number(rows[1]?.up_24h)).toBe(100);
    expect(rows[1]?.down_since).toBeNull();
  });

  it("keeps 30 days of results", async () => {
    await sql.unsafe(
      `update ${schema}.status_checks set checked_at = now() - interval '31 days'
       where id = (select min(id) from ${schema}.status_checks)`,
    );
    const [before] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${schema}.status_checks`,
    );
    await record([check(SITE, true)]);
    const [after] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${schema}.status_checks`,
    );
    expect(Number(after?.n)).toBe(Number(before?.n));
  });

  it("only the server writes results; only admins read them", async () => {
    await expect(
      asAdmin((tx) =>
        tx.unsafe(`select * from ${schema}.record_status_checks($1::jsonb)`, [[] as never]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asAdmin((tx) =>
        tx.unsafe(
          `insert into ${schema}.status_checks (target, url, ok) values ('X', 'https://x.example', true)`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    const seen = await asUser(sql, outsider, (tx) =>
      tx.unsafe(`select * from ${schema}.status_checks`),
    );
    expect(seen).toHaveLength(0);
    await expect(
      record([{ target: "Plain", url: "http://insecure.example", ok: true }]),
    ).rejects.toThrow(/check constraint/);
  });
});
