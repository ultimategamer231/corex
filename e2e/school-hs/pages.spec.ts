// High School edition: accessibility, layout and touch targets of its screens.
import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";
import { type Role, signInAs } from "../school/helpers";

const screens: { role: Role; path: string; heading: string | RegExp }[] = [
  { role: "registrar", path: "/academics/sections", heading: "Sections" },
  { role: "registrar", path: "/academics/marking-periods", heading: "Marking periods" },
  { role: "registrar", path: "/promotions", heading: "Promotions" },
  { role: "registrar", path: "/students/new", heading: "Admit a student" },
  { role: "teacher", path: "/", heading: "Dashboard" },
  { role: "teacher", path: "/grades", heading: "Grades" },
  { role: "teacher", path: "/attendance", heading: "Attendance" },
  { role: "parent", path: "/", heading: "Dashboard" },
  { role: "parent", path: "/grades", heading: /Grades: Kebeh Doe/ },
  { role: "parent", path: "/fees", heading: "Fees" },
];

for (const screen of screens) {
  test(`${screen.role} ${screen.path} is accessible and fits`, async ({ page }, testInfo) => {
    await signInAs(page, screen.role);
    for (const width of widths) {
      await setWidth(page, width);
      await page.goto(screen.path);
      await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
      if (width === 390 || width === 1440) {
        await saveScreenshot(
          page,
          testInfo,
          `school-hs-${screen.role}${screen.path.replaceAll("/", "-") || "-home"}-${width}`,
        );
      }
    }
  });
}

test("College-only pages are not part of the High School edition", async ({ page }) => {
  await signInAs(page, "registrar");
  expect((await page.goto("/registration"))?.status()).toBe(404);
  expect((await page.goto("/academics/courses"))?.status()).toBe(404);
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .first()
      .getByRole("link", { name: "Promotions" }),
  ).toBeAttached();
});

test("a parent sees only their own child", async ({ page }) => {
  await signInAs(page, "parent");
  await page.goto("/grades");
  await expect(page.getByRole("row", { name: /Mathematics/ }).first()).toContainText("83.75");
  await expect(page.getByText("Sando Kamara")).toHaveCount(0);
  expect((await page.goto("/students"))?.status()).toBe(404);
});
