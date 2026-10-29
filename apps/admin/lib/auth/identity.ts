import { z } from "zod";

/**
 * Admins without an email address of their own sign in with a username. Supabase Auth
 * needs an email, so they get one on a reserved domain that never receives mail.
 */
export const USERNAME_EMAIL_DOMAIN = "users.admin.corex.invalid";

export const usernameSchema = z
  .string({ error: "Enter a username" })
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9._-]{2,31}$/,
    "Use 3 to 32 letters, numbers, dots, dashes or underscores, starting with a letter",
  );

export const emailSchema = z
  .string({ error: "Enter an email address" })
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^@\s,()<>;:"]+@[^@\s,()<>;:"]+\.[^@\s,()<>;:"]+$/, "Enter a valid email address");

/** Passwords: at least 12 characters (SPEC-ADMIN.md 3.1). */
export const passwordSchema = z
  .string({ error: "Enter a password" })
  .min(12, "Use at least 12 characters")
  .max(128, "Use at most 128 characters");

export type Identifier = { kind: "email" | "username"; value: string };

/** What an admin types in the sign-in field: an email or a username. */
export function parseIdentifier(input: string): Identifier | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes("@")) {
    const email = emailSchema.safeParse(trimmed);
    return email.success ? { kind: "email", value: email.data } : null;
  }
  const username = usernameSchema.safeParse(trimmed);
  return username.success ? { kind: "username", value: username.data } : null;
}

/** The Supabase Auth email of a new admin. */
export function authEmailFor(username: string, email: string | null): string {
  return email ?? `${username}@${USERNAME_EMAIL_DOMAIN}`;
}

/** The Supabase session id of an access token (JWT claim `session_id`). */
export function sessionIdOf(accessToken: string): string | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      session_id?: unknown;
    };
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}
