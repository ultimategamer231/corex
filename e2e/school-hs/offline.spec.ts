// Offline mode (SPEC.md 10.3) in the School: a class register saved with no connection
// is recorded once on reconnect (OFF-01, OFF-02).
import { expect, test } from "@playwright/test";
import { outboxItems } from "../helpers";
import { open, signInAs } from "../school/helpers";

test("attendance recorded offline syncs once on reconnect (OFF-01)", async ({ page, context }) => {
  // A past school day no other test records.
  const day = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
  await signInAs(page, "teacher");
  await open(page, "/attendance");
  const chooser = page.getByRole("form", { name: "Choose a class and date" });
  await chooser.getByRole("combobox", { name: "Class" }).selectOption({ label: "Grade 11 A" });
  await chooser.getByLabel("Date").fill(day);
  await chooser.getByRole("button", { name: "Open register" }).click();
  await page.waitForLoadState("networkidle");
  const register = page.getByRole("form", { name: "Class register" });
  await expect(register.getByRole("button", { name: "Save register" })).toBeVisible();
  const absent = register.getByRole("radio", { name: /^absent - / }).first();

  await context.setOffline(true);
  await absent.check();
  await register.getByRole("button", { name: "Save register" }).click();
  await expect(register.getByText(/Register saved on this device/)).toBeVisible();
  const waiting = page.getByRole("region", { name: "Registers waiting to sync" });
  await expect(waiting).toContainText("Class register");
  await expect(waiting).toContainText("Pending sync");

  await context.setOffline(false);
  await expect.poll(() => outboxItems(page, "school"), { timeout: 15_000 }).toHaveLength(0);
  await expect(page.getByRole("heading", { name: "Recorded" })).toBeVisible();
  const recorded = page.getByRole("region", { name: "Recorded attendance" });
  await expect(recorded.getByText("absent", { exact: true })).toHaveCount(1);
});
