// Corex Admin sign-in (SPEC-ADMIN.md 3, PROGRESS.md Admin A1): password, then an
// authenticator code; trusted devices; the pause after failed attempts.
import { expect, test } from "@playwright/test";
import { enterCode, enterPassword, fixture, open, OWNER_STATE, signIn, totp } from "./helpers";

test.setTimeout(90_000);

test("search engines are kept out (SPEC-ADMIN.md 2)", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toMatch(/Disallow: \//);
  const login = await request.get("/login");
  expect(login.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/activity");
  await expect(page).toHaveURL(/\/login\?next=%2Factivity/);
});

test("AUTH-01: after the password alone, every page waits for the authenticator code", async ({
  page,
}) => {
  const { verifier } = fixture();
  await enterPassword(page, verifier.email ?? verifier.username);
  await expect(page).toHaveURL(/\/login\/verify/);
  for (const path of ["/", "/activity", "/settings/team"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\/verify/);
  }
  const csv = await page.request.get("/activity/export", { maxRedirects: 0 });
  expect(csv.status()).not.toBe(200);

  await page
    .getByLabel("6-digit code")
    .fill(totp(verifier.secret) === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByText(/That code is not correct/)).toBeVisible();

  await enterCode(page, verifier.secret);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});

test("the username works as well as the email", async ({ page }) => {
  const { plain } = fixture();
  await signIn(page, plain);
  await expect(page.getByRole("button", { name: new RegExp(plain.name) })).toBeVisible();
});

test("AUTH-04: five failed passwords pause sign-in, without saying whether the account exists", async ({
  page,
}) => {
  const name = `ghost${Date.now().toString(36)}`;
  for (let i = 0; i < 5; i++) {
    await enterPassword(page, name, "wrong-password-123");
    await expect(
      page.getByText("The email or username, or the password, is not correct."),
    ).toBeVisible();
  }
  await enterPassword(page, name, "wrong-password-123");
  await expect(page.getByText(/Sign-in is paused for 15 minutes/)).toBeVisible();
});

test("AUTH-06: a trusted device skips the code until it is forgotten", async ({ page }) => {
  const { trusted } = fixture();
  await signIn(page, trusted, { trust: true });
  await page.getByRole("button", { name: /Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await enterPassword(page, trusted.email ?? trusted.username);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({
    timeout: 15_000,
  });

  await open(page, "/settings/security");
  await page.getByRole("button", { name: "Forget my trusted devices" }).click();
  await expect(page.getByText(/trusted devices were forgotten/)).toBeVisible();
  await page.getByRole("button", { name: /Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await enterPassword(page, trusted.email ?? trusted.username);
  await expect(page).toHaveURL(/\/login\/verify/);
});

test.describe("signed in as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("AUTH-08: sign-ins and failures are in the activity log", async ({ page, browser }) => {
    const { owner } = fixture();
    const other = await browser.newContext({ storageState: undefined });
    const visitor = await other.newPage();
    await enterPassword(visitor, owner.username, "not-the-password-1");
    await expect(visitor.getByText(/is not correct/)).toBeVisible();
    await other.close();

    await open(page, "/activity?area=sign_in");
    const table = page.getByRole("region", { name: "Activity log entries" });
    await expect(
      table.getByText("Signed in with password and authenticator code").first(),
    ).toBeVisible();
    await expect(table.getByText(`Failed sign-in for "${owner.username}"`).first()).toBeVisible();
  });
});
