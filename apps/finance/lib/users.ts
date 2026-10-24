import { randomBytes } from "node:crypto";
import { ActionError } from "./action";
import type { Role } from "./roles";
import { getAdminSupabase, type FinanceDb } from "./supabase";

/** A temporary password that meets the sign-in rules (upper, lower, digit, 8+). */
export function temporaryPassword(): string {
  const body = randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
  return `Cx${body}7`;
}

/**
 * Creates a sign-in for a new member (SPEC.md 5.3: no public sign-up). The auth user
 * is created with the service role; the membership row is written as the signed-in
 * Super Admin, so row-level security and the one-email-per-client rule still apply.
 */
export async function createMemberUser(
  db: FinanceDb,
  input: { email: string; displayName: string; role: Role },
): Promise<{ userId: string; password: string }> {
  const admin = getAdminSupabase();
  const password = temporaryPassword();
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new ActionError(
      /already|exists|registered/i.test(created.error?.message ?? "")
        ? "An account with this email already exists. Use a different email address."
        : "The account could not be created. Try again.",
    );
  }
  const userId = created.data.user.id;
  const { error } = await db
    .from("memberships")
    .insert({ user_id: userId, role: input.role, display_name: input.displayName });
  if (error) {
    await admin.auth.admin.deleteUser(userId);
    throw new ActionError(
      error.message.includes("another organization")
        ? error.message
        : "The membership could not be saved.",
    );
  }
  return { userId, password };
}
