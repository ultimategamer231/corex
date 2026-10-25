import { expect, test, type Page } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";
import { signInAs } from "./helpers";

/** A section that exists in every app's navigation. */
const section = { path: "/reports", label: "Reports" };

function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
}

test.describe("app shell", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, "admin");
  });

  for (const width of widths) {
    test(`is accessible and fits at ${width}px`, async ({ page }, testInfo) => {
      await setWidth(page, width);
      await page.goto(section.path);
      await expect(page.getByRole("heading", { level: 1, name: section.label })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
      await saveScreenshot(page, testInfo, `${testInfo.project.name}-shell-${width}`);
    });
  }

  test("skip link moves focus past the navigation", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("desktop sidebar marks the current page and remembers collapse", async ({ page }) => {
    await setWidth(page, 1440);
    await page.goto(section.path);
    const nav = mainNav(page);
    await expect(nav.getByRole("link", { name: section.label })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    // Labels stay available to assistive technology when collapsed.
    await expect(mainNav(page).getByRole("link", { name: section.label })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("mobile uses the bottom bar and the More sheet without trapping focus", async ({ page }) => {
    await setWidth(page, 390);
    await page.goto("/");
    await expect(page.locator("aside")).toBeHidden();
    const more = page.getByRole("button", { name: "More" });
    await more.click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("link", { name: section.label })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
    await more.click();
    await page
      .getByRole("dialog", { name: "More" })
      .getByRole("link", { name: section.label })
      .click();
    await expect(page).toHaveURL(new RegExp(`${section.path}$`));
    await expect(page.getByRole("heading", { level: 1, name: section.label })).toBeVisible();
  });

  test("shows the offline state when the connection drops", async ({ page, context }) => {
    await page.goto("/");
    const status = page.getByRole("status").first();
    await expect(status).toContainText("Online");
    await context.setOffline(true);
    await expect(status).toContainText("Offline");
    await context.setOffline(false);
    await expect(status).toContainText("Online");
  });

  test("user menu opens from the keyboard", async ({ page }) => {
    await setWidth(page, 1440);
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /^Account menu for / });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("unknown sections return 404", async ({ page }) => {
    const response = await page.goto("/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("sends the security headers", async ({ request }) => {
    const headers = (await request.get("/login")).headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});
