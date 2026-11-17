// Accessibility, overflow and touch targets of the admin pages at every width.
import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  setWidth,
  widths,
} from "../helpers";
import { enterPassword, fixture, open, OWNER_STATE } from "./helpers";

// Every page at four widths with an accessibility scan takes a while.
test.setTimeout(180_000);

const signedOutPages = [
  "/login",
  "/forgot-password",
  "/reset-password?token=invalid",
  "/invite/invalid",
];
const appPages = [
  "/",
  "/activity",
  "/settings/team",
  "/settings/security",
  "/leads",
  "/settings/company",
  "/analytics",
  "/status",
  "/money",
  "/support",
];

test("signed-out pages pass at every width", async ({ page }) => {
  for (const path of signedOutPages) {
    for (const width of widths) {
      await setWidth(page, width);
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
    }
  }
});

test("the code step passes at every width", async ({ page }) => {
  const { plain } = fixture();
  await enterPassword(page, plain.username);
  await expect(page).toHaveURL(/\/login\/verify/);
  for (const width of widths) {
    await setWidth(page, width);
    await open(page, "/login/verify");
    await expectNoSeriousA11yViolations(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
  }
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE });
  test("admin pages pass at every width", async ({ page }) => {
    for (const path of appPages) {
      for (const width of widths) {
        await setWidth(page, width);
        await open(page, path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoSeriousA11yViolations(page);
        await expectNoHorizontalOverflow(page);
        await expectTouchTargets(page);
      }
    }
  });
});

test("the admin can be installed: its manifest and icons load without signing in", async ({
  request,
}) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = (await manifest.json()) as {
    name: string;
    display: string;
    icons: { src: string }[];
  };
  expect(body.name).toBe("Corex Admin");
  expect(body.display).toBe("standalone");
  for (const icon of body.icons) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});
