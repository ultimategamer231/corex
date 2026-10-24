// The Finance demo (SPEC.md 11.2, 11.3): banner, role logins, sample entries
// protected, settings read-only, export limit, and its screens at every width.
import { expect, type Page, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";
import { confirm, open } from "../finance/helpers";

async function logInAs(page: Page, label: string) {
  await open(page, "/login");
  await page.getByRole("button", { name: `Log in as ${label}`, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
}

test("the login page lists every role and shows the demo banner", async ({ page }, testInfo) => {
  for (const width of widths) {
    await setWidth(page, width);
    await open(page, "/login");
    const banner = page.getByRole("complementary", { name: "Demo notice" });
    await expect(banner).toContainText("Demo with sample data. Resets every night.");
    await expect(banner.getByRole("link", { name: "Get this system" })).toHaveAttribute(
      "href",
      /\/contact\?product=finance/,
    );
    for (const label of ["Owner", "Accountant", "Staff"]) {
      await expect(page.getByRole("button", { name: `Log in as ${label}` })).toBeVisible();
    }
    await expectNoSeriousA11yViolations(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    if (width === 390) await saveScreenshot(page, testInfo, `finance-demo-login-${width}`);
  }
});

test("?role= preselects the credentials", async ({ page }) => {
  await open(page, "/login?role=accountant");
  await expect(page.getByLabel("Email")).toHaveValue("accountant@finance.demo.corex.test");
  await expect(page.getByLabel("Password")).toHaveValue("Demo@2026");
});

test("sample entries cannot be voided, the visitor's own can", async ({ page }) => {
  await logInAs(page, "Accountant");
  await open(page, "/transactions?type=expense");
  await page.getByRole("table").getByRole("link").first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Void entry", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Reason/).fill("Trying it out");
  await dialog.getByRole("button", { name: "Void entry", exact: true }).click();
  await expect(dialog.getByText(/cannot change sample records/)).toBeVisible();
  await page.keyboard.press("Escape");

  await open(page, "/transactions/new?type=expense");
  const form = page.getByRole("form");
  await form.getByRole("textbox", { name: "Amount" }).fill("15");
  await form
    .getByRole("combobox", { name: "Account", exact: true })
    .selectOption({ label: "Cash box (USD)" });
  await form
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Transport" });
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Entry saved.")).toBeVisible();
  await confirm(page, "Void entry", "Void entry", "Visitor test");
  await expect(page.getByText("Void: Visitor test")).toBeVisible();
});

test("organization settings and users are read-only, long exports are refused", async ({
  page,
}) => {
  await logInAs(page, "Owner");
  await open(page, "/settings");
  await expect(
    page.getByText("Organization settings, users and roles cannot be changed in the demo."),
  ).toBeVisible();
  await expect(page.getByRole("form", { name: "Organization settings" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Add a user" })).toHaveCount(0);

  await open(page, "/reports?report=statement");
  const form = page.getByRole("form", { name: "Choose a report" });
  await form.getByLabel("Account (for statements)").selectOption({ label: "Cash box" });
  await form.getByLabel("From").fill("2020-01-01");
  await form.getByRole("button", { name: "Show report" }).click();
  await expect(
    page.getByText("Demo exports are limited to 200 rows. Choose a shorter period."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Download Excel" })).toHaveCount(0);
});

const screens: { role: string; path: string; heading: string | RegExp }[] = [
  { role: "Owner", path: "/", heading: "Overview" },
  { role: "Owner", path: "/invoices", heading: "Invoices" },
  { role: "Owner", path: "/payroll", heading: "Payroll" },
  { role: "Accountant", path: "/reports", heading: "Reports" },
  { role: "Staff", path: "/transactions", heading: "Transactions" },
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
          `finance-demo-${screen.role.toLowerCase()}${screen.path.replaceAll("/", "-") || "-home"}-${width}`,
        );
      }
    }
  });
}
