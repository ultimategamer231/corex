import { expect, type Page } from "@playwright/test";

/** Schema the Finance app is built against for end-to-end tests (scripts/school-env.mjs). */
export const SCHEMA = "e2e_finance";
export const PASSWORD = "Test@2026pass";

export type Role = "owner" | "accountant" | "staff";

/** Fixture sign-in for a role (packages/db/src/fixtures/finance.ts). */
export function emailFor(role: Role): string {
  return `${role}@${SCHEMA.replace(/_/g, "-")}.corex.test`;
}

/** Navigates and waits until the page is interactive (forms are hydrated). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function signInAs(page: Page, role: Role) {
  await open(page, "/login");
  await page.getByLabel("Email").fill(emailFor(role));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
}

/** Opens a confirmation dialog, fills an optional reason and confirms. */
export async function confirm(page: Page, trigger: string, confirmLabel: string, reason?: string) {
  await page.getByRole("button", { name: trigger, exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (reason !== undefined) await dialog.getByLabel(/Reason/).fill(reason);
  await dialog.getByRole("button", { name: confirmLabel, exact: true }).click();
  await expect(dialog).toBeHidden();
}
