import { expect, type Page } from "@playwright/test";

/** Schema the School app is built against for end-to-end tests (scripts/school-env.mjs). */
export const SCHEMA = "e2e_school";
export const PASSWORD = "Test@2026pass";

export type Role =
  "super_admin" | "registrar" | "instructor" | "teacher" | "bursar" | "student" | "parent";

/** Fixture sign-in for a role (packages/db/src/fixtures/school.ts). */
export function emailFor(role: Role): string {
  return `${role.replace("_", "-")}@${SCHEMA.replace(/_/g, "-")}.corex.test`;
}

/** Navigates and waits until the page is interactive (forms are hydrated). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await open(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Signing in can take a few seconds while other tests load the server.
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({
    timeout: 15_000,
  });
}

export async function signInAs(page: Page, role: Role) {
  await signIn(page, emailFor(role));
}

/** Opens a confirmation dialog, fills an optional reason and confirms. */
export async function confirm(page: Page, trigger: string, confirmLabel: string, reason?: string) {
  await page.getByRole("button", { name: trigger, exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (reason !== undefined) await dialog.getByLabel(/Reason|Note/).fill(reason);
  await dialog.getByRole("button", { name: confirmLabel, exact: true }).click();
  await expect(dialog).toBeHidden();
}
