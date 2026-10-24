import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";

/** Every public page of the website (SPEC.md 6.7). */
const routes = [
  { path: "/", name: "home" },
  { path: "/software", name: "software" },
  { path: "/software/school", name: "school" },
  { path: "/software/clinic", name: "clinic" },
  { path: "/software/finance", name: "finance" },
  { path: "/software/on-request", name: "on-request" },
  { path: "/services/ai-automation", name: "ai-automation" },
  { path: "/services/it-consultancy", name: "it-consultancy" },
  { path: "/services/training", name: "training" },
  { path: "/pricing", name: "pricing" },
  { path: "/about", name: "about" },
  { path: "/contact", name: "contact" },
  { path: "/legal/terms", name: "terms" },
  { path: "/legal/privacy", name: "privacy" },
  { path: "/legal/license", name: "license" },
];

for (const route of routes) {
  test.describe(`${route.name} page`, () => {
    for (const width of widths) {
      test(`is accessible and fits at ${width}px`, async ({ page }, testInfo) => {
        await setWidth(page, width);
        const response = await page.goto(route.path);
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expectNoSeriousA11yViolations(page);
        await expectNoHorizontalOverflow(page);
        await expectTouchTargets(page);
        if (width === 390 || width === 1440)
          await saveScreenshot(page, testInfo, `web-${route.name}-${width}`);
      });
    }
  });
}

test("every page has a unique title, description and canonical link", async ({ page }) => {
  const titles = new Set<string>();
  for (const route of routes) {
    await page.goto(route.path);
    const title = await page.title();
    expect(title, route.path).not.toBe("");
    titles.add(title);
    await expect(page.locator('meta[name="description"]'), route.path).toHaveAttribute(
      "content",
      /.{20,}/,
    );
    await expect(page.locator('link[rel="canonical"]'), route.path).toHaveAttribute(
      "href",
      new RegExp(`${route.path === "/" ? "" : route.path}$`),
    );
  }
  expect(titles.size).toBe(routes.length);
});

test("links to WhatsApp and phone with the primary number", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Talk to us on WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/231770021026\?text=/,
  );
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "+231 775 178 905" })).toHaveAttribute(
    "href",
    "tel:+231775178905",
  );
  await expect(footer.getByRole("link", { name: "+231 777 352 002" })).toHaveAttribute(
    "href",
    "tel:+231777352002",
  );
});

test("product pages link each demo role to the product's demo login", async ({ page }) => {
  await page.goto("/software/clinic");
  const demo = page.locator("#demo");
  const links = demo.getByRole("link", { name: /^Log in as / });
  expect(await links.count()).toBeGreaterThan(0);
  for (const href of await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
    expect(href).toMatch(/^https:\/\/demo-clinic\.[^/]+\/login\?role=[a-z_-]+$/);
  }
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

test("draft case studies stay hidden in production", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Our work" })).toHaveCount(0);
  expect((await page.goto("/work"))?.status()).toBe(404);
  expect((await page.goto("/work/sample-use-case-1"))?.status()).toBe(404);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/work");
  expect(sitemap).not.toContain("/legal");
});

test("unknown pages show the not found page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
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
