// The College demo (SPEC.md 11.2, 11.3): banner, role logins, sample records
// protected, settings read-only, and its screens accessible at every width.
import { expect, type Page, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";
import { open } from "../school/helpers";

async function logInAs(page: Page, label: string) {
  await open(page, "/login");
  await page.getByRole("button", { name: `Log in as ${label}`, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
}

test("the login page lists every role and shows the demo banner", async ({ page }, testInfo) => {
  for (const width of widths) {
    await setWidth(page, width);
    await open(page, "/login");
    const banner = page.getByRole("complementary", { name: "Demo notice" });
    await expect(banner).toContainText("Demo with sample data. Resets every night.");
    await expect(banner.getByRole("link", { name: "Get this system" })).toHaveAttribute(
      "href",
      /\/contact\?product=school-college/,
    );
    for (const label of ["Admin", "Registrar", "Instructor", "Bursar", "Student"]) {
      await expect(page.getByRole("button", { name: `Log in as ${label}` })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    if (width === 390 || width === 1440)
      await saveScreenshot(page, testInfo, `demo-login-${width}`);
  }
});

test("?role= preselects the credentials", async ({ page }) => {
  await open(page, "/login?role=registrar");
  await expect(page.getByLabel("Email")).toHaveValue("registrar@college.demo.corex.test");
  await expect(page.getByLabel("Password")).toHaveValue("Demo@2026");
});

test("a visitor cannot edit a sample student but can add their own", async ({ page }) => {
  await logInAs(page, "Registrar");
  await expect(page.getByRole("complementary", { name: "Demo notice" })).toBeVisible();
  await open(page, "/students");
  await page.getByRole("table").getByRole("link").first().click();
  await page.waitForLoadState("networkidle");
  const details = page.getByRole("form", { name: "Student details" });
  await details.getByLabel("Phone").fill("+231 770 123 456");
  await details.getByRole("button", { name: "Save details" }).click();
  await expect(details.getByText(/cannot change sample records/)).toBeVisible();

  await open(page, "/students/new");
  const person = page.getByRole("group", { name: "Student" });
  await person.getByRole("textbox", { name: "First name" }).fill("Visitor");
  await person.getByRole("textbox", { name: "Last name" }).fill("Tester");
  await person.getByLabel("Date of birth").fill("2003-02-14");
  await page
    .getByRole("combobox", { name: "Program", exact: true })
    .selectOption({ label: "BSC-CS Bachelor of Science in Computer Science" });
  await page.getByRole("button", { name: "Admit student" }).click();
  await expect(page.getByText(/Student admitted with number CDC-\d{4}-\d{4}/)).toBeVisible();
});

test("settings and users are read-only for the demo admin", async ({ page }, testInfo) => {
  await logInAs(page, "Admin");
  await open(page, "/settings");
  await expect(
    page.getByText("Settings, users and roles cannot be changed in the demo."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save settings" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Add a staff member" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Suspend / })).toHaveCount(0);
  await saveScreenshot(page, testInfo, "demo-admin-settings-1440");
});

const screens: { role: string; path: string; heading: string | RegExp }[] = [
  { role: "Registrar", path: "/", heading: "Dashboard" },
  { role: "Registrar", path: "/registration", heading: /Registration/ },
  { role: "Registrar", path: "/students", heading: "Students" },
  { role: "Instructor", path: "/attendance", heading: "Attendance" },
  { role: "Instructor", path: "/grades", heading: "Grades" },
  { role: "Bursar", path: "/fees", heading: "Fees" },
  { role: "Bursar", path: "/fees/invoices", heading: /Invoices/ },
  { role: "Student", path: "/planning", heading: "Course planning" },
];

for (const screen of screens) {
  test(`demo ${screen.role} ${screen.path} is accessible and fits`, async ({ page }, testInfo) => {
    await logInAs(page, screen.role);
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
          `demo-${screen.role.toLowerCase()}${screen.path.replaceAll("/", "-") || "-home"}-${width}`,
        );
      }
    }
  });
}
