// Shared by the Corex Admin database tests: verified admins and API roles.
import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { createTestUser, type LocalKeys, testEmail } from "./helpers.ts";

export type TestAdmin = { userId: string; sessionId: string; adminId: string };

/** An active admin with a session that passed the authenticator step. */
export async function verifiedAdmin(
  sql: Sql,
  keys: LocalKeys,
  schema: string,
  username: string,
  users: string[],
): Promise<TestAdmin> {
  const userId = await createTestUser(keys, testEmail(username), "Admin-Test-2026!");
  users.push(userId);
  const sessionId = randomUUID();
  const [row] = await sql.unsafe<{ id: string }[]>(
    `insert into ${schema}.admins (user_id, username, name, status)
     values ($1, $2, $3, 'active') returning id`,
    [userId, username, `Admin ${username}`],
  );
  await sql.unsafe(
    `insert into ${schema}.admin_sessions (user_id, session_id, method) values ($1, $2, 'authenticator')`,
    [userId, sessionId],
  );
  if (!row) throw new Error("admin not inserted");
  return { userId, sessionId, adminId: row.id };
}

/** Runs `fn` as the API would for this admin's signed-in session. */
export function asAdmin<T>(
  sql: Sql,
  who: { userId: string; sessionId: string },
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    const claims = { sub: who.userId, role: "authenticated", session_id: who.sessionId };
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx);
  }) as Promise<T>;
}

/** Server code with the service role and no admin named (the website, jobs). */
export function asServiceRole<T>(sql: Sql, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "service_role" })}, true)`;
    await tx.unsafe("set local role service_role");
    return fn(tx);
  }) as Promise<T>;
}
