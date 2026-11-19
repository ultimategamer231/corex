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
  // The dashboard checklist ticks a step once its page is opened. The Registrar's menu
  // reaches five of the steps (fees belong to the Bursar).
  const steps = page.getByRole("region", { name: "Things to try in this demo" });
  await expect(steps).toContainText("0 of 5 done");
  await steps.getByRole("link", { name: "Open a student's record" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Students" })).toBeVisible();
  await page.getByRole("table").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/students\/[0-9a-f-]{36}/);
  await open(page, "/");
  await expect(steps).toContainText("1 of 5 done");
  await expect(steps.getByRole("link", { name: /Open a student's record \(done\)/ })).toBeVisible();
  for (const width of widths) {
    await setWidth(page, width);
    await open(page, "/");
    await expectNoSeriousA11yViolations(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
  }
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

test.describe("loading feedback", () => {
  // The offline service worker answers page requests itself, so page.route could not
  // slow them down.
  test.use({ serviceWorkers: "block" });
  test("a tapped role card says Signing in, and Search shows the loading bar", async ({ page }) => {
    await setWidth(page, 390);
    await open(page, "/login");
    // Slow the sign-in down so the wait can be seen.
    await page.route("**/login**", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.getByRole("button", { name: "Log in as Registrar", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Signing in..." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    await open(page, "/students");
    await page.route(/\/students\?q=/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    const find = page.getByRole("search", { name: "Find students" });
    await find.getByLabel("Name or student number").fill("Barclay");
    // Checked inside the page: while the next page loads, the test runner itself waits
    // for it and cannot look at the page being left.
    const shown = await find.evaluate(async (form) => {
      (form as HTMLFormElement).requestSubmit();
      await new Promise((r) => setTimeout(r, 300));
      return {
        bar: document.body.textContent?.includes("Loading page") ?? false,
        busy: document.getElementById("main")?.getAttribute("aria-busy") ?? null,
      };
    });
    expect(shown).toEqual({ bar: true, busy: "true" });
    await expect(page).toHaveURL(/q=Barclay/);
  });
});
