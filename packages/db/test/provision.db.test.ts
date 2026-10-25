import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionSchema, ProvisionError } from "../src/provision.ts";
import { readRegistry } from "../src/registry.ts";
import { supabaseAdmin } from "../src/supabase-admin.ts";
import {
  deleteTestBuckets,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
  uniqueSchema,
  unexposeSchemasLocally,
  userIdsByEmail,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const supabase = supabaseAdmin({ url: keys.apiUrl, serviceRoleKey: keys.serviceRoleKey });
const registryPath = join(mkdtempSync(join(tmpdir(), "corex-provision-")), "schemas.json");
const schoolSchema = uniqueSchema("prov_school");
const clinicSchema = uniqueSchema("prov_clinic");
const schoolAdmin = testEmail("school-admin");
const clinicAdmin = testEmail("clinic-admin");

beforeAll(async () => {
  await provisionSchema(sql, supabase, {
    schema: schoolSchema,
    product: "school",
    org: "Bethel College",
    adminEmail: schoolAdmin,
    adminName: "Jartu Kollie",
    project: "local",
    exposeLocally: true,
    registryPath,
  });
  await provisionSchema(sql, supabase, {
    schema: clinicSchema,
    product: "clinic",
    org: "Sample Medical Center",
    adminEmail: clinicAdmin,
    project: "local",
    exposeLocally: true,
    registryPath,
  });
});

afterAll(async () => {
  await unexposeSchemasLocally(sql, schoolSchema, clinicSchema);
  await dropSchemas(sql, schoolSchema, clinicSchema);
  await deleteTestBuckets(keys, schoolSchema, clinicSchema);
  await deleteTestUsers(keys, ...(await userIdsByEmail(sql, schoolAdmin, clinicAdmin)));
  await sql.end();
});

describe("db:provision (SPEC.md 4.4)", () => {
  it("creates and migrates both schemas", async () => {
    const core = [
      "core/0001_core_tables",
      "core/0002_access",
      "core/0003_audit",
      "core/0004_billing",
    ];
    const expected = {
      [schoolSchema]: [
        ...core,
        "school/0001_school",
        "school/0002_college",
        "school/0003_highschool",
      ],
      [clinicSchema]: ["clinic/0001_clinic", "clinic/0002_workflow_guards", ...core],
    };
    for (const [schema, ids] of Object.entries(expected)) {
      const rows = await sql.unsafe<{ id: string }[]>(
        `select id from ${schema}._migrations order by id`,
      );
      expect(rows.map((r) => r.id)).toEqual(ids);
    }
  });

  it("writes the organization into settings", async () => {
    const [row] = await sql.unsafe<{ org_name: string; base_currency: string; timezone: string }[]>(
      `select org_name, base_currency, timezone from ${schoolSchema}.settings`,
    );
    expect(row).toEqual({
      org_name: "Bethel College",
      base_currency: "USD",
      timezone: "Africa/Monrovia",
    });
  });

  it("creates a private storage bucket", async () => {
    const { data, error } = await supabase.storage.getBucket(schoolSchema);
    expect(error).toBeNull();
    expect(data?.public).toBe(false);
  });

  it("invites the first administrator with the product's top role", async () => {
    const [schoolId] = await userIdsByEmail(sql, schoolAdmin);
    const school = await sql.unsafe<{ user_id: string; role: string; display_name: string }[]>(
      `select user_id, role, display_name from ${schoolSchema}.memberships`,
    );
    expect(school).toEqual([
      { user_id: schoolId, role: "super_admin", display_name: "Jartu Kollie" },
    ]);
    const clinic = await sql.unsafe<{ role: string }[]>(
      `select role from ${clinicSchema}.memberships`,
    );
    expect(clinic).toEqual([{ role: "admin" }]);
  });

  it("registers both schemas", () => {
    expect(readRegistry(registryPath).map((e) => [e.schema, e.product, e.project])).toEqual(
      [
        [clinicSchema, "clinic", "local"],
        [schoolSchema, "school", "local"],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  });

  it("is safe to run again", async () => {
    const before = readFileSync(registryPath, "utf8");
    const result = await provisionSchema(sql, supabase, {
      schema: schoolSchema,
      product: "school",
      org: "Bethel College",
      adminEmail: schoolAdmin,
      project: "local",
      registryPath,
    });
    expect(result.migrations.applied).toEqual([]);
    expect(result.invited).toBe(false);
    expect(readFileSync(registryPath, "utf8")).toBe(before);
  });

  it("refuses an email that already belongs to another client (SPEC.md 4.3.7)", async () => {
    await expect(
      provisionSchema(sql, supabase, {
        schema: uniqueSchema("prov_other"),
        product: "finance",
        org: "Other Ltd",
        adminEmail: schoolAdmin,
        project: "local",
        registryPath,
      }),
    ).rejects.toThrow(ProvisionError);
  });

  it("rejects invalid input before touching the database", async () => {
    await expect(
      provisionSchema(sql, supabase, {
        schema: "public",
        product: "school",
        org: "X",
        adminEmail: "a@b.co",
        project: "local",
        registryPath,
      }),
    ).rejects.toThrow(/reserved/);
    await expect(
      provisionSchema(sql, supabase, {
        schema: uniqueSchema("prov_bad"),
        product: "school",
        org: "X",
        adminEmail: "not-an-email",
        project: "local",
        registryPath,
      }),
    ).rejects.toThrow(/Invalid admin email/);
  });
});
