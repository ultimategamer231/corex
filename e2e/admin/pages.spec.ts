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

test.describe("Billing menu item", () => {
  test.use({ storageState: OWNER_STATE });
  for (const width of [390, 1440]) {
    test(`says Billing and opens invoices and receipts at ${width}px`, async ({ page }) => {
      await setWidth(page, width);
      await open(page, "/");
      const menu = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
      await expect(menu.getByRole("link", { name: "Invoices and receipts" })).toHaveCount(0);
      await menu.getByRole("link", { name: "Billing" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Invoices and receipts" }),
      ).toBeVisible();
    });
  }
});

test.describe("loading feedback", () => {
  test.use({ storageState: OWNER_STATE });
  test("a tapped menu link shows the loading bar until the page arrives", async ({ page }) => {
    await setWidth(page, 390);
    await open(page, "/");
    // Slow the next page down so the wait can be seen.
    await page.route("**/clients**", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    const menu = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    await menu.getByRole("link", { name: "Clients" }).click();
    await expect(page.getByText("Loading page")).toBeAttached({ timeout: 1000 });
    await expect(page.locator("#main")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Clients" })).toBeVisible();
    await expect(page.getByText("Loading page")).not.toBeAttached();
    await expect(page.locator("#main")).not.toHaveAttribute("aria-busy", "true");
  });
});
