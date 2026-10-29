import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe (one-time links and device tokens). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database keeps instead of a token (SHA-256, hex). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** How long each kind of one-time link stays valid. */
export const LINK_HOURS = {
  invite: 72,
  authenticator_setup: 72,
  /** A reset link sent to the admin's own email. */
  password_reset_email: 1,
  /** A reset link another admin creates and passes on, for example on WhatsApp. */
  password_reset_link: 24,
} as const;

export function hoursFromNow(hours: number, now = new Date()): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}
