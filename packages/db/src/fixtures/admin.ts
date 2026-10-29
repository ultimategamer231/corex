// Corex Admin fixture for local development and end-to-end tests: five active admins
// with passwords and authenticator apps already set up. Local stack only; never run
// against a real project.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Sql } from "postgres";
import { totpCode } from "../admin/totp.ts";
import { USERNAME_EMAIL_DOMAIN } from "../admin/team.ts";
import { migrateSchema } from "../migrations.ts";
import { exposeSchemaLocally } from "../provision.ts";
import { assertSchemaName } from "../schema-name.ts";

export const ADMIN_FIXTURE_PASSWORD = "Admin-Fixture-2026";

export type AdminFixtureUser = {
  name: string;
  username: string;
  email: string | null;
  /** Base32 authenticator secret, for an authenticator app or `totpCode`. */
  secret: string;
};

/** Separate admins, so end-to-end tests never reuse one authenticator code at once. */
export const ADMIN_FIXTURE_KEYS = ["owner", "staff", "verifier", "plain", "trusted"] as const;
export type AdminFixtureKey = (typeof ADMIN_FIXTURE_KEYS)[number];

export type AdminFixture = { schema: string; users: Record<AdminFixtureKey, AdminFixtureUser> };

/** Drops and rebuilds `schema` (product admin) with five active admins. */
export async function seedAdminFixture(
  sql: Sql,
  service: SupabaseClient,
  local: { apiUrl: string; anonKey: string },
  schemaName: string,
): Promise<AdminFixture> {
  const s = assertSchemaName(schemaName);
  const exists = await sql`select 1 from pg_namespace where nspname = ${s}`;
  const oldUsers = exists.length
    ? await sql.unsafe<{ user_id: string }[]>(`select user_id from ${s}.admins`)
    : [];
  await sql.unsafe(`drop schema if exists ${s} cascade`);
  for (const { user_id } of oldUsers) await service.auth.admin.deleteUser(user_id);
  await migrateSchema(sql, s, "admin");
  await exposeSchemaLocally(sql, s);

  const domain = `${s.replace(/_/g, "-")}.corex.test`;
  const people: { key: AdminFixtureKey; name: string; username: string; email: string | null }[] = [
    { key: "owner", name: "Fatu Admin", username: "owner", email: `owner@${domain}` },
    { key: "staff", name: "Maima Gbessay", username: "maima", email: null },
    { key: "verifier", name: "Ama Sirleaf", username: "ama", email: `ama@${domain}` },
    { key: "plain", name: "Kebeh Toe", username: "kebeh", email: null },
    { key: "trusted", name: "Joseph Flomo", username: "joseph", email: `joseph@${domain}` },
  ];
  const users = {} as AdminFixture["users"];
  for (const person of people) {
    const email =
      person.email ?? `${person.username}.${s.replace(/_/g, "-")}@${USERNAME_EMAIL_DOMAIN}`;
    const stale = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
    for (const { id } of stale) await service.auth.admin.deleteUser(id);
    const created = await service.auth.admin.createUser({
      email,
      password: ADMIN_FIXTURE_PASSWORD,
      email_confirm: true,
      user_metadata: { name: person.name },
    });
    if (created.error) throw created.error;
    const userId = created.data.user.id;
    await sql.unsafe(
      `insert into ${s}.admins (user_id, username, name, email, status) values ($1, $2, $3, $4, 'active')`,
      [userId, person.username, person.name, person.email],
    );

    const client = createClient(local.apiUrl, local.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signedIn = await client.auth.signInWithPassword({
      email,
      password: ADMIN_FIXTURE_PASSWORD,
    });
    if (signedIn.error) throw signedIn.error;
    const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Fixture" });
    if (enrolled.error) throw enrolled.error;
    const verified = await client.auth.mfa.challengeAndVerify({
      factorId: enrolled.data.id,
      code: totpCode(enrolled.data.totp.secret),
    });
    if (verified.error) throw verified.error;
    await client.auth.signOut();
    users[person.key] = {
      name: person.name,
      username: person.username,
      email: person.email,
      secret: enrolled.data.totp.secret,
    };
  }
  return { schema: s, users };
}
