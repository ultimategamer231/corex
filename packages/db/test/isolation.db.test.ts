// Cross-client isolation through the real Supabase API (SPEC.md 4.3.3).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionSchema } from "../src/provision.ts";
import { supabaseAdmin } from "../src/supabase-admin.ts";
import {
  createTestUser,
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
const admin = supabaseAdmin({ url: keys.apiUrl, serviceRoleKey: keys.serviceRoleKey });
const registryPath = join(mkdtempSync(join(tmpdir(), "corex-isolation-")), "schemas.json");
const schemaA = uniqueSchema("iso_a");
const schemaB = uniqueSchema("iso_b");
const password = "Isolation@2026";
const emails = {
  a: testEmail("client-a"),
  b: testEmail("client-b"),
  adminA: testEmail("admin-a"),
  adminB: testEmail("admin-b"),
};
let userA = "";
let userB = "";
let clientA: SupabaseClient;
let anon: SupabaseClient;

function anonClient() {
  return createClient(keys.apiUrl, keys.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

/** PostgREST reloads its schema list asynchronously; wait until both schemas answer. */
async function waitForExposure(client: SupabaseClient) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const results = await Promise.all(
      [schemaA, schemaB].map((schema) => client.schema(schema).from("settings").select("org_name")),
    );
    if (results.every((r) => !r.error)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("PostgREST did not expose the test schemas in time");
}

beforeAll(async () => {
  for (const [schema, product, org, adminEmail] of [
    [schemaA, "school", "Client A College", emails.adminA],
    [schemaB, "finance", "Client B Trading", emails.adminB],
  ] as const) {
    await provisionSchema(sql, admin, {
      schema,
      product,
      org,
      adminEmail,
      project: "local",
      exposeLocally: true,
      registryPath,
    });
  }
  userA = await createTestUser(keys, emails.a, password);
  userB = await createTestUser(keys, emails.b, password);
  await sql.unsafe(
    `insert into ${schemaA}.memberships (user_id, role, display_name) values ($1, 'super_admin', 'A')`,
    [userA],
  );
  await sql.unsafe(
    `insert into ${schemaB}.memberships (user_id, role, display_name) values ($1, 'owner', 'B')`,
    [userB],
  );
  await sql.unsafe(
    `with c as (insert into ${schemaB}.counterparties (name, type) values ('Test customer', 'customer') returning id)
     insert into ${schemaB}.invoices (party_type, party_id, currency) select 'counterparty', c.id, 'LRD' from c`,
  );
  clientA = await signedIn(emails.a);
  anon = anonClient();
  await waitForExposure(clientA);
});

afterAll(async () => {
  await unexposeSchemasLocally(sql, schemaA, schemaB);
  await dropSchemas(sql, schemaA, schemaB);
  await deleteTestBuckets(keys, schemaA, schemaB);
  await deleteTestUsers(
    keys,
    userA,
    userB,
    ...(await userIdsByEmail(sql, emails.adminA, emails.adminB)),
  );
  await sql.end();
});

describe("a signed-in user of client A", () => {
  it("can use client A's schema", async () => {
    const { data, error } = await clientA.schema(schemaA).from("settings").select("org_name");
    expect(error).toBeNull();
    expect(data).toEqual([{ org_name: "Client A College" }]);
  });

  it.each(["settings", "memberships", "invoices", "audit_events", "announcements", "files"])(
    "receives no rows from client B's %s",
    async (table) => {
      const { data, error } = await clientA.schema(schemaB).from(table).select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("cannot change client B's settings", async () => {
    const { data, error } = await clientA
      .schema(schemaB)
      .from("settings")
      .update({ org_name: "Taken over" })
      .eq("id", true)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const [row] = await sql.unsafe<{ org_name: string }[]>(
      `select org_name from ${schemaB}.settings`,
    );
    expect(row?.org_name).toBe("Client B Trading");
  });

  it("cannot make itself a member or administrator of client B", async () => {
    const { error } = await clientA
      .schema(schemaB)
      .from("memberships")
      .insert({ user_id: userA, role: "owner", display_name: "Intruder" });
    expect(error?.code).toBe("42501");
    const rows = await sql.unsafe(`select 1 from ${schemaB}.memberships where user_id = $1`, [
      userA,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("cannot write client B's records", async () => {
    const { error } = await clientA
      .schema(schemaB)
      .from("announcements")
      .insert({ title: "Spam", body: "x" });
    expect(error?.code).toBe("42501");
  });

  it("is not treated as a member by client B's helpers", async () => {
    const isAdmin = await clientA.schema(schemaB).rpc("is_admin");
    expect(isAdmin.data).toBe(false);
    const view = await clientA
      .schema(schemaB)
      .rpc("log_view", { p_table_name: "invoices", p_record_id: crypto.randomUUID() });
    expect(view.error?.message).toMatch(/not a member/);
  });

  it("cannot read or upload files in client B's bucket", async () => {
    await admin.storage
      .from(schemaB)
      .upload("private/report.txt", new Blob(["secret"]), { upsert: true });
    const list = await clientA.storage.from(schemaB).list("private");
    expect(list.data ?? []).toEqual([]);
    const download = await clientA.storage.from(schemaB).download("private/report.txt");
    expect(download.data).toBeNull();
    const upload = await clientA.storage.from(schemaB).upload("private/evil.txt", new Blob(["x"]));
    expect(upload.error).not.toBeNull();
  });
});

describe("one client per email (SPEC.md 4.3.7)", () => {
  it("stops client B's administrator from adding client A's user", async () => {
    const adminB = await signedIn(emails.b);
    const { error } = await adminB
      .schema(schemaB)
      .from("memberships")
      .insert({ user_id: userA, role: "staff", display_name: "Borrowed" });
    expect(error?.message).toMatch(/already belongs to another organization/);
    const rows = await sql.unsafe(`select 1 from ${schemaB}.memberships where user_id = $1`, [
      userA,
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("an anonymous visitor (SPEC.md 4.3.4)", () => {
  it.each([
    ["A", () => schemaA],
    ["B", () => schemaB],
  ])("cannot read client %s's tables", async (_label, schema) => {
    const { data, error } = await anon.schema(schema()).from("settings").select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe("sign-up (SPEC.md 5.3)", () => {
  it("is closed to the public; administrators create users", async () => {
    const { data, error } = await anon.auth.signUp({ email: testEmail("stranger"), password });
    expect(data.user).toBeNull();
    expect(error?.message).toMatch(/signups not allowed/i);
  });
});

describe("suspension (SPEC.md 5.3)", () => {
  it("cuts off a user whose membership is suspended, even with a valid session", async () => {
    await sql.unsafe(`update ${schemaA}.memberships set status = 'suspended' where user_id = $1`, [
      userA,
    ]);
    const { data, error } = await clientA.schema(schemaA).from("settings").select("org_name");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
