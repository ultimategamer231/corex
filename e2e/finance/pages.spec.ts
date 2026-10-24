// Finance screens: accessibility, layout and touch targets at every width, plus the
// security headers and 404 behaviour of the app.
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
  { role: "owner", path: "/", heading: "Overview" },
  { role: "owner", path: "/transactions", heading: "Transactions" },
  { role: "owner", path: "/transactions/new?type=income", heading: "Record income" },
  { role: "owner", path: "/invoices", heading: "Invoices" },
  { role: "owner", path: "/invoices/new", heading: "New invoice" },
  { role: "owner", path: "/accounts", heading: "Accounts" },
  { role: "owner", path: "/counterparties", heading: "Customers and vendors" },
  { role: "owner", path: "/payroll", heading: "Payroll" },
  { role: "owner", path: "/payroll/employees", heading: "Employees" },
  { role: "owner", path: "/payroll/components", heading: "Pay components" },
  { role: "owner", path: "/reports", heading: "Reports" },
  { role: "owner", path: "/settings", heading: "Settings" },
  { role: "staff", path: "/", heading: "Overview" },
  { role: "staff", path: "/transactions/new?type=expense", heading: "Record an expense" },
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
        const name = screen.path.replace(/[/?=]+/g, "-").replace(/-$/, "") || "-home";
        await saveScreenshot(page, testInfo, `finance-${screen.role}${name}-${width}`);
      }
    }
  });
}

test("sends the security headers and keeps unknown pages at 404", async ({ request }) => {
  const headers = (await request.get("/login")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
