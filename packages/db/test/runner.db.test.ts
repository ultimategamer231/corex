import { afterAll, describe, expect, it } from "vitest";
import { loadMigrations, migrateSchema, MigrationError } from "../src/migrations.ts";
import { dropSchemas, fixturesRoot, testDb, uniqueSchema } from "./helpers.ts";

const sql = testDb();
const created: string[] = [];

function newSchema() {
  const schema = uniqueSchema("runner");
  created.push(schema);
  return schema;
}

afterAll(async () => {
  await dropSchemas(sql, ...created);
  await sql.end();
});

describe("migrateSchema (SPEC.md 4.4)", () => {
  it("applies core then product migrations and records them", async () => {
    const schema = newSchema();
    const result = await migrateSchema(
      sql,
      schema,
      "school",
      loadMigrations("school", fixturesRoot),
    );
    expect(result.applied).toEqual(["core/0001_items", "school/0001_school_items"]);
    const columns = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = ${schema} and table_name = 'items' order by ordinal_position`;
    expect(columns.map((c) => c.column_name)).toEqual(["id", "name", "grade"]);
    const recorded = await sql.unsafe<{ id: string }[]>(
      `select id from ${schema}._migrations order by id`,
    );
    expect(recorded.map((r) => r.id)).toEqual(["core/0001_items", "school/0001_school_items"]);
  });

  it("skips migrations that are already applied", async () => {
    const schema = newSchema();
    const migrations = loadMigrations("school", fixturesRoot);
    await migrateSchema(sql, schema, "school", migrations);
    const second = await migrateSchema(sql, schema, "school", migrations);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toHaveLength(2);
  });

  it("refuses an applied migration whose file was edited", async () => {
    const schema = newSchema();
    const migrations = loadMigrations("school", fixturesRoot);
    await migrateSchema(sql, schema, "school", migrations);
    const edited = migrations.map((m, i) => (i === 0 ? { ...m, checksum: "changed" } : m));
    await expect(migrateSchema(sql, schema, "school", edited)).rejects.toThrow(MigrationError);
  });

  it("refuses to turn a school schema into a clinic schema", async () => {
    const schema = newSchema();
    await migrateSchema(sql, schema, "school", loadMigrations("school", fixturesRoot));
    await expect(
      migrateSchema(sql, schema, "clinic", loadMigrations("clinic", fixturesRoot)),
    ).rejects.toThrow(/cannot also be a clinic schema/);
  });

  it("rolls back everything when a migration fails", async () => {
    const schema = newSchema();
    const migrations = [
      ...loadMigrations("school", fixturesRoot),
      {
        id: "school/0002_broken",
        template: "select * from {{schema}}.missing_table;",
        checksum: "x",
      },
    ];
    await expect(migrateSchema(sql, schema, "school", migrations)).rejects.toThrow();
    const exists =
      await sql`select 1 from information_schema.schemata where schema_name = ${schema}`;
    expect(exists).toHaveLength(0);
  });

  it("keeps the migrations table away from app users", async () => {
    const schema = newSchema();
    await migrateSchema(sql, schema, "school", loadMigrations("school", fixturesRoot));
    const [row] = await sql`
      select relrowsecurity as rls,
        has_table_privilege('authenticated', ${`${schema}._migrations`}, 'select') as auth_select,
        has_table_privilege('anon', ${`${schema}._migrations`}, 'select') as anon_select
      from pg_class where oid = ${`${schema}._migrations`}::regclass`;
    expect(row).toEqual({ rls: true, auth_select: false, anon_select: false });
  });
});
