import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import { assertSchemaName } from "../schema-name.ts";
import type { AdminClient } from "../supabase-admin.ts";

/** Same rules as apps/admin/lib/auth/identity.ts. */
export const USERNAME_EMAIL_DOMAIN = "users.admin.corex.invalid";
const USERNAME = /^[a-z][a-z0-9._-]{2,31}$/;
const EMAIL = /^[^@\s,()<>;:"]+@[^@\s,()<>;:"]+\.[^@\s,()<>;:"]+$/;

export class AdminSetupError extends Error {
  override name = "AdminSetupError";
}

function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token, "utf8").digest("hex") };
}

export type FirstAdminInput = {
  schema: string;
  name: string;
  username: string;
  email: string | null;
  adminUrl: string;
};

/**
 * Creates the first Corex Admin account (status invited) and returns a 72-hour set-up
 * link. Refuses when any admin is already active: later admins are invited from
 * Settings → Team.
 */
export async function createFirstAdmin(
  sql: Sql,
  auth: AdminClient,
  input: FirstAdminInput,
): Promise<{ adminId: string; link: string }> {
  assertSchemaName(input.schema);
  const username = input.username.trim().toLowerCase();
  const email = input.email?.trim().toLowerCase() || null;
  if (!USERNAME.test(username))
    throw new AdminSetupError(
      "Username: 3 to 32 letters, numbers, dots, dashes or underscores, starting with a letter.",
    );
  if (email && !EMAIL.test(email)) throw new AdminSetupError("Email is not valid.");
  if (input.name.trim().length < 2) throw new AdminSetupError("Name is too short.");

  const [active] = await sql.unsafe<{ n: number }[]>(
    `select count(*)::int as n from ${input.schema}.admins where status = 'active'`,
  );
  if ((active?.n ?? 0) > 0) {
    throw new AdminSetupError("An admin already exists. Invite more admins from Settings → Team.");
  }

  const existing = await sql.unsafe<{ id: string; status: string }[]>(
    `select id, status from ${input.schema}.admins where username = $1 or email = $2`,
    [username, email],
  );
  let adminId = existing.find((a) => a.status === "invited")?.id;
  if (!adminId) {
    if (existing.length > 0) throw new AdminSetupError("This username or email was used before.");
    const created = await auth.auth.admin.createUser({
      email: email ?? `${username}@${USERNAME_EMAIL_DOMAIN}`,
      password: `${randomBytes(32).toString("base64url")}Aa1!`,
      email_confirm: true,
      user_metadata: { name: input.name.trim() },
    });
    if (created.error || !created.data.user) {
      throw new AdminSetupError(
        `Could not create the account: ${created.error?.message ?? "unknown error"}`,
      );
    }
    const [row] = await sql.unsafe<{ id: string }[]>(
      `insert into ${input.schema}.admins (user_id, username, name, email, status)
       values ($1, $2, $3, $4, 'invited') returning id`,
      [created.data.user.id, username, input.name.trim(), email],
    );
    if (!row) throw new AdminSetupError("Could not record the admin.");
    adminId = row.id;
  }

  const link = await issueSetupLink(sql, input.schema, adminId, "invite");
  return { adminId, link: `${input.adminUrl.replace(/\/$/, "")}/invite/${link}` };
}

/** Voids older unused links of `kind` and stores a new 72-hour one; returns the token. */
async function issueSetupLink(
  sql: Sql,
  schema: string,
  adminId: string,
  kind: "invite" | "authenticator_setup",
): Promise<string> {
  const { token, hash } = newToken();
  await sql.unsafe(
    `update ${schema}.admin_tokens set expires_at = now()
     where admin_id = $1 and kind = $2 and used_at is null and expires_at > now()`,
    [adminId, kind],
  );
  await sql.unsafe(
    `insert into ${schema}.admin_tokens (admin_id, kind, token_hash, expires_at)
     values ($1, $2, $3, now() + interval '72 hours')`,
    [adminId, kind, hash],
  );
  return token;
}

/**
 * Recovery when the only admin lost their phone: removes their authenticator, ends
 * their sessions and trusted devices, and returns a 72-hour set-up link.
 */
export async function resetAdminAuthenticator(
  sql: Sql,
  auth: AdminClient,
  input: { schema: string; username: string; adminUrl: string },
): Promise<string> {
  assertSchemaName(input.schema);
  const [admin] = await sql.unsafe<{ id: string; user_id: string; name: string }[]>(
    `select id, user_id, name from ${input.schema}.admins where username = $1 and status = 'active'`,
    [input.username.trim().toLowerCase()],
  );
  if (!admin) throw new AdminSetupError("No active admin has this username.");
  const factors = await auth.auth.admin.mfa.listFactors({ userId: admin.user_id });
  for (const factor of factors.data?.factors ?? []) {
    await auth.auth.admin.mfa.deleteFactor({ id: factor.id, userId: admin.user_id });
  }
  await sql.begin(async (tx) => {
    await tx.unsafe(
      `update ${input.schema}.admin_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`,
      [admin.user_id],
    );
    await tx.unsafe(
      `update ${input.schema}.trusted_devices set revoked_at = now() where user_id = $1 and revoked_at is null`,
      [admin.user_id],
    );
    await tx.unsafe(
      `select ${input.schema}.log_event('team', 'authenticator_reset', $1, null, 'system', 'admins', $2)`,
      [
        `Authenticator of ${admin.name} reset from the command line; signed out everywhere`,
        admin.id,
      ],
    );
  });
  const token = await issueSetupLink(sql, input.schema, admin.id, "authenticator_setup");
  return `${input.adminUrl.replace(/\/$/, "")}/invite/${token}`;
}
