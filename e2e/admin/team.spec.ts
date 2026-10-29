// Settings → Team (SPEC-ADMIN.md 3, PROGRESS.md Admin A1): invite by link, accept with
// a password and an authenticator app, reset links, removal (AUTH-07).
import { expect, test } from "@playwright/test";
import { enterCode, enterPassword, fixture, open, OWNER_STATE, totp } from "./helpers";

test.setTimeout(90_000);
test.use({ storageState: OWNER_STATE });

test("an invited admin sets a password and an authenticator, and removal blocks them at once", async ({
  page,
  browser,
}) => {
  const username = `kollie${Date.now().toString(36).slice(-5)}`;
  await open(page, "/settings/team");
  const invite = page.getByRole("form", { name: "Invite an admin" });
  await invite.getByLabel(/^Name/).fill("Prince Kollie");
  await invite.getByLabel(/^Username/).fill(username);
  await invite.getByRole("button", { name: "Create invite" }).click();
  const link = await page.getByLabel(/Invite link/).inputValue();
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

  const context = await browser.newContext({ storageState: undefined });
  const newcomer = await context.newPage();
  await newcomer.goto(new URL(link).pathname);
  await newcomer.waitForLoadState("networkidle");
  await expect(newcomer.getByRole("heading", { name: "Welcome, Prince Kollie" })).toBeVisible();
  await newcomer.getByLabel(/^Password/).fill("short");
  await newcomer.getByLabel("Repeat the password").fill("short");
  await newcomer.getByRole("button", { name: "Continue" }).click();
  await expect(newcomer.getByText("Use at least 12 characters")).toBeVisible();
  await newcomer.getByLabel(/^Password/).fill("Kollie-Password-2026");
  await newcomer.getByLabel("Repeat the password").fill("Kollie-Password-2026");
  await newcomer.getByRole("button", { name: "Continue" }).click();
  const secret = (await newcomer.getByTestId("totp-secret").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]+$/);
  await expect(newcomer.getByRole("img", { name: /QR code/ })).toBeVisible();
  await newcomer.getByLabel("6-digit code").fill(totp(secret));
  await newcomer.getByRole("button", { name: "Finish set-up" }).click();
  await expect(newcomer.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({
    timeout: 15_000,
  });

  // The invite link worked once.
  const reuse = await context.newPage();
  await reuse.goto(new URL(link).pathname);
  await expect(reuse.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();

  await open(page, "/settings/team");
  const row = page.getByRole("row").filter({ hasText: username });
  await expect(row.getByText("Active")).toBeVisible();
  await row.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row.getByText("Removed")).toBeVisible();

  await newcomer.goto("/activity");
  // Banned and signed out everywhere: back to sign in.
  await expect(newcomer).toHaveURL(/\/login/);
  await enterPassword(newcomer, username, "Kollie-Password-2026");
  await expect(
    newcomer.getByText("The email or username, or the password, is not correct."),
  ).toBeVisible();
  await context.close();

  await open(page, `/activity?area=team`);
  await expect(
    page.getByText(`Removed Prince Kollie (${username}); signed out everywhere`),
  ).toBeVisible();
});

test("a reset link lets an admin without email choose a new password", async ({
  page,
  browser,
}) => {
  const { staff } = fixture();
  await open(page, "/settings/team");
  const row = page.getByRole("row").filter({ hasText: staff.name });
  await row.getByRole("button", { name: "Reset link" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = await dialog.getByLabel("Link").inputValue();
  expect(link).toMatch(/\/reset-password\?token=/);

  const context = await browser.newContext({ storageState: undefined });
  const other = await context.newPage();
  const url = new URL(link);
  await other.goto(`${url.pathname}${url.search}`);
  await other.waitForLoadState("networkidle");
  const newPassword = `Maima-New-2026-${Date.now().toString(36)}`;
  await other.getByRole("textbox", { name: /^New password/ }).fill(newPassword);
  await other.getByLabel("Repeat the new password").fill(newPassword);
  await other.getByRole("button", { name: "Save new password" }).click();
  await expect(
    other.getByText("Your password was changed. Sign in with the new one."),
  ).toBeVisible();
  await enterPassword(other, staff.username, newPassword);
  await enterCode(other, staff.secret);
  await expect(other.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await context.close();
});

test("no admin can remove themselves, so one always remains (AUTH-07)", async ({ page }) => {
  await open(page, "/settings/team");
  const self = page.getByRole("row").filter({ hasText: "(you)" });
  await expect(self.getByRole("button")).toHaveCount(0);
});

test("security settings are saved and logged", async ({ page }) => {
  await open(page, "/settings/security");
  await page.getByLabel("Sign out after inactivity").selectOption("480");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Security settings saved.")).toBeVisible();
  await page.getByLabel("Sign out after inactivity").selectOption("240");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Security settings saved.")).toBeVisible();
  await open(page, "/activity?area=settings");
  await expect(page.getByText("Changed settings").first()).toBeVisible();
});

test("the activity log exports the filtered entries to CSV (LOG-04)", async ({ page }) => {
  await open(page, "/activity?area=sign_in");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^corex-activity-log-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((c) => Buffer.concat(c).toString());
  expect(text.split("\r\n")[0]).toBe(
    "Entry,When (GMT),Admin,Area,Action,What happened,Record type,Record,Changes,IP address,Browser",
  );
  expect(text).toContain("Sign-ins");
  expect(text).not.toContain(",Team,");
});
