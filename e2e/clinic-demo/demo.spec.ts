// The Clinic demo (SPEC.md 11.2, 11.3): banner, role logins, sample records protected
// while visitors try the workflows on their own records, settings read-only, the
// export limit, and its screens at every width.
import { expect, type Page, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";
import { open } from "../clinic/helpers";

async function logInAs(page: Page, label: string) {
  await open(page, "/login");
  await page.getByRole("button", { name: `Log in as ${label}`, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
}

test("the login page lists every role and shows the demo banner", async ({ page }, testInfo) => {
  for (const width of widths) {
    await setWidth(page, width);
    await open(page, "/login");
    const banner = page.getByRole("complementary", { name: "Demo notice" });
    await expect(banner).toContainText("Demo with sample data. Resets every night.");
    await expect(banner.getByRole("link", { name: "Get this system" })).toHaveAttribute(
      "href",
      /\/contact\?product=clinic/,
    );
    for (const label of ["Admin", "Doctor", "Nurse", "Receptionist", "Cashier"]) {
      await expect(page.getByRole("button", { name: `Log in as ${label}` })).toBeVisible();
    }
    await expectNoSeriousA11yViolations(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    if (width === 390) await saveScreenshot(page, testInfo, `clinic-demo-login-${width}`);
  }
});

test("?role= preselects the credentials", async ({ page }) => {
  await open(page, "/login?role=reception");
  await expect(page.getByLabel("Email")).toHaveValue("reception@clinic.demo.corex.test");
  await expect(page.getByLabel("Password")).toHaveValue("Demo@2026");
});

test("sample appointments cannot be cancelled, the visitor's own can", async ({ page }) => {
  await logInAs(page, "Receptionist");
  // Tomorrow, or Monday when tomorrow is Sunday, is fully booked with sample appointments.
  const next = new Date(Date.now() + 86_400_000);
  if (next.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1);
  await open(page, `/appointments?date=${next.toISOString().slice(0, 10)}`);
  const sample = page
    .getByRole("listitem")
    .filter({ has: page.getByText("Booked", { exact: true }) })
    .first();
  await sample.getByRole("button", { name: "Cancel", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Reason/).fill("Trying it out");
  await dialog.getByRole("button", { name: "Cancel appointment", exact: true }).click();
  await expect(dialog.getByText(/cannot change sample records/)).toBeVisible();
  await page.keyboard.press("Escape");

  await open(page, "/patients/new");
  const form = page.getByRole("form", { name: "Register patient" });
  await form.getByRole("textbox", { name: "First name" }).fill("Visitor");
  await form.getByRole("textbox", { name: "Last name" }).fill("Tester");
  await form.getByRole("combobox", { name: "Sex" }).selectOption("male");
  await form.getByRole("combobox", { name: "Allergies" }).selectOption("no");
  await form.getByRole("button", { name: "Register patient" }).click();
  await expect(page.getByText(/Patient registered as PT-/)).toBeVisible();
  await page.getByRole("link", { name: "Book appointment" }).click();
  const book = page.getByRole("form", { name: "Book appointment" });
  await page.waitForLoadState("networkidle");
  await book
    .getByRole("combobox", { name: "Clinician" })
    .selectOption({ label: "Dr. Martha Tamba" });
  await book.getByLabel("Time").fill("07:00");
  await book.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByText("Appointment booked.")).toBeVisible();
  const own = page.getByRole("listitem").filter({ hasText: "Visitor Tester" });
  await own.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/Reason/)
    .fill("Visitor test");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel appointment", exact: true })
    .click();
  await expect(own.getByText("Cancelled: Visitor test")).toBeVisible();
});

test("the Cashier takes a payment on a sample bill but cannot void sample payments", async ({
  page,
}) => {
  await logInAs(page, "Cashier");
  await open(page, "/billing?status=issued");
  await page.getByRole("region", { name: "Bills" }).getByRole("link").first().click();
  await page.waitForLoadState("networkidle");
  const pay = page.getByRole("form", { name: "Record a payment" });
  await pay.getByRole("textbox", { name: /Amount/ }).fill("1");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Payment recorded\. Receipt RCT-\d{6} issued\./)).toBeVisible();

  await open(page, "/billing?status=paid");
  await page.getByRole("region", { name: "Bills" }).getByRole("link").first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Void payment", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Reason/).fill("Trying it out");
  await dialog.getByRole("button", { name: "Void payment", exact: true }).click();
  await expect(dialog.getByText(/cannot change sample records/)).toBeVisible();
});

test("organization settings and users are read-only, long exports are refused", async ({
  page,
}) => {
  await logInAs(page, "Admin");
  await open(page, "/settings");
  await expect(
    page.getByText("Organization settings, users and roles cannot be changed in the demo."),
  ).toBeVisible();
  await expect(page.getByRole("form", { name: "Organization settings" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Add a user" })).toHaveCount(0);

  await open(page, "/reports?report=cash&from=2020-01-01");
  await expect(
    page.getByText("Demo exports are limited to 200 rows. Choose a shorter period."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Download Excel" })).toHaveCount(0);
});

const screens: { role: string; path: string; heading: string | RegExp }[] = [
  { role: "Admin", path: "/", heading: "Today" },
  { role: "Admin", path: "/reports", heading: "Reports" },
  { role: "Receptionist", path: "/appointments", heading: "Appointments" },
  { role: "Receptionist", path: "/queue", heading: "Queue" },
  { role: "Doctor", path: "/", heading: "Today" },
  { role: "Cashier", path: "/billing", heading: "Billing" },
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
          `clinic-demo-${screen.role.toLowerCase()}${screen.path.replaceAll("/", "-") || "-home"}-${width}`,
        );
      }
    }
  });
}

test("the Doctor sees a sample visit's signed notes and vitals", async ({ page }) => {
  await logInAs(page, "Doctor");
  await open(page, "/patients");
  await page.getByRole("region", { name: "Patients" }).getByRole("link").first().click();
  await page
    .getByRole("link", { name: /\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: /^Visit: / })).toBeVisible();
  await expect(page.getByText(/Version \d, signed by Dr\./).first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
