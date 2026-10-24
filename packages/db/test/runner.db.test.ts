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

describe("schema safety checks (SPEC.md 4.3)", () => {
  const base = () => loadMigrations("school", fixturesRoot);

  it("rolls back a migration that creates a table without row-level security", async () => {
    const schema = newSchema();
    const migrations = [
      ...base(),
      {
        id: "school/0002_open_table",
        template: "create table {{schema}}.grades (id uuid primary key);",
        checksum: "a",
      },
    ];
    await expect(migrateSchema(sql, schema, "school", migrations)).rejects.toThrow(
      /Row-level security is not enabled/,
    );
    const exists =
      await sql`select 1 from information_schema.schemata where schema_name = ${schema}`;
    expect(exists).toHaveLength(0);
  });

  it("rolls back a view that would bypass row-level security", async () => {
    const schema = newSchema();
    const migrations = [
      ...base(),
      {
        id: "school/0002_view",
        template: "create view {{schema}}.item_names as select name from {{schema}}.items;",
        checksum: "b",
      },
    ];
    await expect(migrateSchema(sql, schema, "school", migrations)).rejects.toThrow(
      /security_invoker/,
    );
  });

  it("accepts security_invoker views", async () => {
    const schema = newSchema();
    const migrations = [
      ...base(),
      {
        id: "school/0002_view",
        template:
          "create view {{schema}}.item_names with (security_invoker = true) as select name from {{schema}}.items;",
        checksum: "c",
      },
    ];
    await expect(migrateSchema(sql, schema, "school", migrations)).resolves.toBeTruthy();
  });

  it("does not let app users call functions unless a migration grants them", async () => {
    const schema = newSchema();
    const migrations = [
      ...base(),
      {
        id: "school/0002_function",
        template:
          "create function {{schema}}.secret_fn() returns int language sql security definer as $$ select 1 $$;",
        checksum: "d",
      },
    ];
    await migrateSchema(sql, schema, "school", migrations);
    const [row] = await sql`
      select has_function_privilege('authenticated', ${`${schema}.secret_fn()`}, 'execute') as auth,
             has_function_privilege('anon', ${`${schema}.secret_fn()`}, 'execute') as anon`;
    expect(row).toEqual({ auth: false, anon: false });
  });
});
