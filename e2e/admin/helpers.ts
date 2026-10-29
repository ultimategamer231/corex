import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Schema the admin app is built against for end-to-end tests (scripts/school-env.mjs). */
export const SCHEMA = "e2e_admin";
export const PASSWORD = "Admin-Fixture-2026";
/** Written by setup.ts: sign-ins and authenticator secrets (packages/db/src/fixtures/admin.ts). */
export const FIXTURE_FILE = join(tmpdir(), "corex-e2e-admin.json");

/** The owner's signed-in browser state, saved by setup.ts for tests that start signed in. */
export const OWNER_STATE = join(tmpdir(), "corex-e2e-admin-owner.json");

export type FixtureUser = { name: string; username: string; email: string | null; secret: string };
type Users = Record<"owner" | "staff" | "verifier" | "plain" | "trusted", FixtureUser>;

/**
 * Fixture admins. Each test that enters an authenticator code uses its own admin: a
 * code is accepted once, so parallel tests must not share one.
 */
export function fixture(): Users {
  return (JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as { users: Users }).users;
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** The code an authenticator app shows now (RFC 6238). */
export function totp(secret: string, at = Date.now()): string {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    value = (value << 5) | B32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Navigates and waits until the page is interactive (forms are hydrated). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function enterPassword(page: Page, identifier: string, password = PASSWORD) {
  await open(page, "/login");
  await page.getByLabel("Email or username").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Enters the current authenticator code; retries once in the next 30-second step. */
export async function enterCode(page: Page, secret: string, options: { trust?: boolean } = {}) {
  await expect(page).toHaveURL(/\/login\/verify/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  if (options.trust) await page.getByLabel(/Trust this device/).check();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    try {
      await expect(page).not.toHaveURL(/\/login\/verify/, { timeout: 10_000 });
      return;
    } catch {
      await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
    }
  }
  throw new Error("The authenticator code was not accepted");
}

export async function signIn(page: Page, user: FixtureUser, options: { trust?: boolean } = {}) {
  await enterPassword(page, user.email ?? user.username);
  await enterCode(page, user.secret, options);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({
    timeout: 15_000,
  });
}
