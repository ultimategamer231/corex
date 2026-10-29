import type { LinkKind } from "./auth/links";
import { hashToken, hoursFromNow, randomToken } from "./auth/tokens";
import { adminEnv } from "./env";
import type { AdminDb } from "./supabase";

/**
 * Creates a one-time link for `adminId` and voids their older unused links of the same
 * kind. Returns the full URL; only its hash is stored.
 */
export async function issueLink(
  service: AdminDb,
  adminId: string,
  kind: LinkKind,
  hours: number,
): Promise<string> {
  const now = new Date().toISOString();
  await service
    .from("admin_tokens")
    .update({ expires_at: now })
    .eq("admin_id", adminId)
    .eq("kind", kind)
    .is("used_at", null)
    .gt("expires_at", now);
  const token = randomToken();
  const { error } = await service.from("admin_tokens").insert({
    admin_id: adminId,
    kind,
    token_hash: hashToken(token),
    expires_at: hoursFromNow(hours),
  });
  if (error) throw new Error(`Could not create the link: ${error.message}`);
  const base = adminEnv().adminUrl;
  return kind === "password_reset"
    ? `${base}/reset-password?token=${token}`
    : `${base}/invite/${token}`;
}

/** Ends every session and trusted device of a user (authenticator reset, password reset). */
export async function signOutEverywhere(service: AdminDb, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await service
    .from("admin_sessions")
    .update({ revoked_at: now })
    .eq("user_id", userId)
    .is("revoked_at", null);
  await service
    .from("trusted_devices")
    .update({ revoked_at: now })
    .eq("user_id", userId)
    .is("revoked_at", null);
}
