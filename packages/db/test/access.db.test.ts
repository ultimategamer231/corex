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
const schema = uniqueSchema("access");
const users = { admin: "", registrar: "", suspended: "", outsider: "", dual: "" };

beforeAll(async () => {
  await migrateSchema(sql, schema, "school");
  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    users[name] = await createTestUser(keys, testEmail(name), "Test@2026pass");
  }
  await sql.unsafe(`insert into ${schema}.settings (org_name) values ('Sample College')`);
  await sql.unsafe(
    `insert into ${schema}.memberships (user_id, role, status, display_name) values
      ($1, 'super_admin', 'active', 'Admin'),
      ($2, 'registrar', 'active', 'Registrar'),
      ($3, 'super_admin', 'suspended', 'Suspended admin'),
      ($4, 'registrar', 'active', 'Dual'),
      ($4, 'bursar', 'active', 'Dual')`,
    [users.admin, users.registrar, users.suspended, users.dual],
  );
  await sql.unsafe(
    `insert into ${schema}.invoices (party_type, party_id, currency) values ('student', gen_random_uuid(), 'USD')`,
  );
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, ...Object.values(users));
  await sql.end();
});

const settingsRows = (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
  tx.unsafe(`select org_name from ${schema}.settings`);

describe("anonymous access (SPEC.md 4.3.4)", () => {
  it("cannot reach the schema at all", async () => {
    await expect(asUser(sql, null, settingsRows)).rejects.toThrow(/permission denied for schema/);
  });

  it("cannot call the membership helpers", async () => {
    await expect(
      asUser(sql, null, (tx) => tx.unsafe(`select ${schema}.is_member()`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("membership-based access (SPEC.md 4.3.1-2)", () => {
  it("gives a signed-in user without membership no rows and no writes", async () => {
    expect(await asUser(sql, users.outsider, settingsRows)).toHaveLength(0);
    const updated = await asUser(sql, users.outsider, (tx) =>
      tx.unsafe(`update ${schema}.settings set org_name = 'Hacked' returning 1`),
    );
    expect(updated).toHaveLength(0);
    await expect(
      asUser(sql, users.outsider, (tx) =>
        tx.unsafe(
          `insert into ${schema}.memberships (user_id, role, display_name) values ($1, 'super_admin', 'Me')`,
          [users.outsider],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets an active member read settings but not change them", async () => {
    expect(await asUser(sql, users.registrar, settingsRows)).toEqual([
      { org_name: "Sample College" },
    ]);
    const updated = await asUser(sql, users.registrar, (tx) =>
      tx.unsafe(`update ${schema}.settings set org_name = 'Changed' returning 1`),
    );
    expect(updated).toHaveLength(0);
  });

  it("shows a non-admin only their own membership rows", async () => {
    const rows = await asUser(sql, users.registrar, (tx) =>
      tx.unsafe<{ user_id: string }[]>(`select user_id from ${schema}.memberships`),
    );
    expect(rows.map((r) => r.user_id)).toEqual([users.registrar]);
  });

  it("lets an administrator update settings and manage memberships", async () => {
    const updated = await asUser(sql, users.admin, (tx) =>
      tx.unsafe(`update ${schema}.settings set phone = '+231 770 000 000' returning phone`),
    );
    expect(updated).toEqual([{ phone: "+231 770 000 000" }]);
    const memberships = await asUser(sql, users.admin, (tx) =>
      tx.unsafe(`select user_id from ${schema}.memberships`),
    );
    expect(memberships.length).toBe(5);
  });

  it("supports two roles for one user", async () => {
    const [row] = await asUser(sql, users.dual, (tx) =>
      tx.unsafe<{ roles: string[]; bursar: boolean; admin: boolean }[]>(
        `select ${schema}.current_roles() as roles, ${schema}.has_role(array['bursar']) as bursar, ${schema}.is_admin() as admin`,
      ),
    );
    expect(row).toEqual({ roles: ["bursar", "registrar"], bursar: true, admin: false });
  });

  it("keeps billing records from members without a billing role", async () => {
    const asRegistrar = await asUser(sql, users.registrar, (tx) =>
      tx.unsafe(`select id from ${schema}.invoices`),
    );
    expect(asRegistrar).toHaveLength(0);
    const asAdmin = await asUser(sql, users.admin, (tx) =>
      tx.unsafe(`select id from ${schema}.invoices`),
    );
    expect(asAdmin).toHaveLength(1);
  });

  it("does not let anyone delete billing records (CORE-07)", async () => {
    const deleted = await asUser(sql, users.admin, (tx) =>
      tx.unsafe(`delete from ${schema}.invoices returning id`),
    );
    expect(deleted).toHaveLength(0);
  });
});

describe("suspended membership (SPEC.md 5.3)", () => {
  it("blocks a suspended user even with a valid session", async () => {
    expect(await asUser(sql, users.suspended, settingsRows)).toHaveLength(0);
    const updated = await asUser(sql, users.suspended, (tx) =>
      tx.unsafe(`update ${schema}.settings set org_name = 'x' returning 1`),
    );
    expect(updated).toHaveLength(0);
    const [row] = await asUser(sql, users.suspended, (tx) =>
      tx.unsafe<{ admin: boolean }[]>(`select ${schema}.is_admin() as admin`),
    );
    expect(row?.admin).toBe(false);
  });
});
