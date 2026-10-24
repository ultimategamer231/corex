// Accessibility, layout and touch targets of the School screens at every width.
import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";
import { type Role, signInAs } from "./helpers";

const screens: { role: Role; path: string; heading: string | RegExp }[] = [
  { role: "registrar", path: "/", heading: "Dashboard" },
  { role: "registrar", path: "/students", heading: "Students" },
  { role: "registrar", path: "/students/new", heading: "Admit a student" },
  { role: "registrar", path: "/academics/offerings", heading: "Course offerings" },
  { role: "registrar", path: "/registration", heading: "Registration" },
  { role: "instructor", path: "/attendance", heading: "Attendance" },
  { role: "student", path: "/planning", heading: "Course planning" },
  { role: "student", path: "/grades", heading: "My grades" },
  { role: "bursar", path: "/fees", heading: "Fees" },
  { role: "super_admin", path: "/settings", heading: "Settings" },
];

test("the sign-in page is accessible at every width", async ({ page }, testInfo) => {
  for (const width of widths) {
    await setWidth(page, width);
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    if (width === 390) await saveScreenshot(page, testInfo, `school-login-${width}`);
  }
});

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
          `school-${screen.role}${screen.path.replaceAll("/", "-") || "-home"}-${width}`,
        );
      }
    }
  });
}

test("signed-out visitors are sent to sign in", async ({ page }) => {
  const response = await page.goto("/students");
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(response?.status()).toBe(200);
});

test("a role cannot open another role's pages", async ({ page }) => {
  await signInAs(page, "student");
  const response = await page.goto("/students");
  expect(response?.status()).toBe(404);
  await signInAs(page, "instructor");
  expect((await page.goto("/fees"))?.status()).toBe(404);
});

test("the School app sends the security headers", async ({ request }) => {
  const headers = (await request.get("/login")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
