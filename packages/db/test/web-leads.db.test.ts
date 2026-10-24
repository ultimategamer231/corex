// corex_web: website leads and rate limits (SPEC.md 6.6).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadMigrations, migrateSchema } from "../src/migrations.ts";
import { asUser, dropSchemas, testDb, uniqueSchema } from "./helpers.ts";

const sql = testDb();
const schema = uniqueSchema("web");

beforeAll(async () => {
  await migrateSchema(sql, schema, "web");
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await sql.end();
});

describe("corex_web migrations", () => {
  it("contain only the website tables, not client core tables", async () => {
    expect(loadMigrations("web").map((m) => m.id)).toEqual(["web/0001_leads"]);
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = ${schema} order by table_name`;
    expect(tables.map((t) => t.table_name)).toEqual(["_migrations", "leads", "rate_limits"]);
  });

  it("stores a lead with status new and requires consent", async () => {
    const [lead] = await sql.unsafe<{ status: string }[]>(
      `insert into ${schema}.leads (name, organization, country, product, phone, message, consent, source_page)
       values ('Musu Johnson', 'Bethel High School', 'Liberia', 'school-highschool', '+231 770 000 000', 'We have 400 students.', true, '/contact')
       returning status`,
    );
    expect(lead?.status).toBe("new");
    await expect(
      sql.unsafe(
        `insert into ${schema}.leads (name, organization, country, product, phone, message, consent)
         values ('A B', 'Org', 'Liberia', 'clinic', '0770000000', 'Long enough message', false)`,
      ),
    ).rejects.toThrow();
  });

  it("allows 5 quote requests per key per hour, then refuses", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const [row] = await sql.unsafe<{ ok: boolean }[]>(
        `select ${schema}.hit_rate_limit('ip:203.0.113.9', 5, 3600) as ok`,
      );
      results.push(row?.ok ?? false);
    }
    expect(results).toEqual([true, true, true, true, true, false, false]);
    const [other] = await sql.unsafe<{ ok: boolean }[]>(
      `select ${schema}.hit_rate_limit('ip:198.51.100.1', 5, 3600) as ok`,
    );
    expect(other?.ok).toBe(true);
  });

  it("is closed to anonymous and signed-in API users", async () => {
    await expect(
      asUser(sql, null, (tx) => tx.unsafe(`select * from ${schema}.leads`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(sql, crypto.randomUUID(), (tx) => tx.unsafe(`select * from ${schema}.leads`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(sql, null, (tx) => tx.unsafe(`select ${schema}.hit_rate_limit('x', 5, 3600)`)),
    ).rejects.toThrow(/permission denied/);
  });
});
