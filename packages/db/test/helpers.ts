import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Sql, TransactionSql } from "postgres";
import { connect } from "../src/db.ts";
import { LOCAL_DATABASE_URL } from "../src/env.ts";
import { localSupabaseStatus } from "../src/local-supabase.ts";
export { unexposeSchemasLocally } from "../src/provision.ts";

export const fixturesRoot = new URL("./fixtures", import.meta.url).pathname;

/** Connection to the local Supabase database used by integration tests. */
export function testDb(): Sql {
  return connect(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
}

/** A unique, valid schema name so test files never collide. */
export function uniqueSchema(prefix = "test"): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

export async function dropSchemas(sql: Sql, ...schemas: string[]): Promise<void> {
  for (const schema of schemas) {
    await sql.unsafe(`drop schema if exists ${schema} cascade`);
  }
}

export type LocalKeys = { apiUrl: string; anonKey: string; serviceRoleKey: string };

/** Local Supabase URL and development keys. */
export function localKeys(): LocalKeys {
  const status = localSupabaseStatus();
  return {
    apiUrl: status.API_URL,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  };
}

/** Creates a confirmed auth user with a password; returns its id. */
export async function createTestUser(
  keys: LocalKeys,
  email: string,
  password: string,
): Promise<string> {
  const admin = createClient(keys.apiUrl, keys.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

export async function deleteTestUsers(keys: LocalKeys, ...ids: string[]): Promise<void> {
  const admin = createClient(keys.apiUrl, keys.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}

/**
 * Runs `fn` inside a transaction as an authenticated API user, the way PostgREST
 * does (role `authenticated`, JWT claims with `sub`). Pass `null` for anon.
 */
export async function asUser<T>(
  sql: Sql,
  userId: string | null,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    const role = userId ? "authenticated" : "anon";
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId ?? undefined, role })}, true)`;
    await tx.unsafe(`set local role ${role}`);
    return fn(tx);
  }) as Promise<T>;
}

export function testEmail(label: string): string {
  return `${label}-${randomBytes(4).toString("hex")}@test.corex.local`;
}

/** Deletes storage buckets created by provisioning tests. */
export async function deleteTestBuckets(keys: LocalKeys, ...buckets: string[]): Promise<void> {
  const admin = createClient(keys.apiUrl, keys.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const bucket of buckets) {
    await admin.storage.emptyBucket(bucket);
    await admin.storage.deleteBucket(bucket);
  }
}

/** Auth user ids for the given emails (provisioning invites users by email). */
export async function userIdsByEmail(sql: Sql, ...emails: string[]): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`select id from auth.users where email = any(${emails})`;
  return rows.map((r) => r.id);
}

/** The local stack's S3-compatible Storage endpoint and keys (stand-in for Cloudflare R2). */
export function localS3(bucket: string) {
  const status = localSupabaseStatus();
  return {
    endpoint: status.STORAGE_S3_URL,
    region: status.S3_PROTOCOL_REGION,
    bucket,
    accessKeyId: status.S3_PROTOCOL_ACCESS_KEY_ID,
    secretAccessKey: status.S3_PROTOCOL_ACCESS_KEY_SECRET,
  };
}
