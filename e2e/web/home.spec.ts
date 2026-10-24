import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";

test.describe("website placeholder home", () => {
  for (const width of widths) {
    test(`is accessible and fits at ${width}px`, async ({ page }, testInfo) => {
      await setWidth(page, width);
      await page.goto("/");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Business software you can test before you pay",
        }),
      ).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
      await saveScreenshot(page, testInfo, `web-home-${width}`);
    });
  }

  test("links to WhatsApp and phone with the primary number", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Talk to us on WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/231770021026\?text=/,
    );
    await expect(page.getByRole("link", { name: /Call \+231 770 021 026/ })).toHaveAttribute(
      "href",
      "tel:+231770021026",
    );
  });

  test("skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("sends the security headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
