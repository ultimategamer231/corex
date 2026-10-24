// SPEC.md 9.5: create accounts, record income and expense, transfer, invoice with a
// partial payment, payroll approved and paid, reports with the expected totals.
// (Recording an entry offline is covered with the offline work in Step 12.)
import { expect, type Page, test } from "@playwright/test";
import { confirm, open, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

// A 1x1 PNG, as a receipt photo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function addAccount(page: Page, name: string, opening: string) {
  const form = page.getByRole("form", { name: "Add an account" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Type").selectOption("Cash");
  await form.getByLabel("Currency").selectOption("USD");
  await form.getByLabel("Opening balance").fill(opening);
  await form.getByRole("button", { name: "Add account" }).click();
  await expect(form.getByText(`Account ${name} added.`)).toBeVisible();
}

async function record(
  page: Page,
  type: "income" | "expense" | "transfer",
  fields: { amount: string; account: string; to?: string; category?: string; receipt?: boolean },
) {
  await open(page, `/transactions/new?type=${type}`);
  const form = page.getByRole("form");
  const select = (name: string) => form.getByRole("combobox", { name, exact: true });
  await form.getByRole("textbox", { name: "Amount" }).fill(fields.amount);
  await select(type === "transfer" ? "From account" : "Account").selectOption({
    label: `${fields.account} (USD)`,
  });
  if (fields.to) await select("To account").selectOption({ label: `${fields.to} (USD)` });
  if (fields.category) await select("Category").selectOption({ label: fields.category });
  if (fields.receipt) {
    await form
      .getByLabel("Receipt photo")
      .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
  }
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Entry saved.")).toBeVisible();
}

async function statementClosing(page: Page, account: string): Promise<string> {
  await open(page, "/reports");
  const form = page.getByRole("form", { name: "Choose a report" });
  await form.getByLabel("Report").selectOption({ label: "Account statement" });
  await form.getByLabel("Account (for statements)").selectOption({ label: account });
  await form.getByRole("button", { name: "Show report" }).click();
  const row = page.getByRole("row", { name: /Closing balance/ });
  await expect(row).toBeVisible();
  return (await row.getByRole("cell").last().textContent()) ?? "";
}

test("the Owner creates two accounts", async ({ page }) => {
  await signInAs(page, "owner");
  await open(page, "/accounts");
  await addAccount(page, "E2E Cash", "100");
  await addAccount(page, "E2E Bank", "0");
  await expect(page.getByRole("row", { name: /E2E Cash/ })).toContainText("US$100.00");
});

test("income, an expense with a receipt photo and a transfer update the balances", async ({
  page,
}) => {
  await signInAs(page, "owner");
  await record(page, "income", { amount: "500", account: "E2E Cash", category: "Sales" });
  await record(page, "expense", {
    amount: "120",
    account: "E2E Cash",
    category: "Rent",
    receipt: true,
  });
  await expect(page.getByRole("link", { name: "Open the receipt" })).toBeVisible();
  await record(page, "transfer", { amount: "200", account: "E2E Cash", to: "E2E Bank" });
  await open(page, "/accounts");
  await expect(page.getByRole("row", { name: /E2E Cash/ })).toContainText("US$280.00");
  await expect(page.getByRole("row", { name: /E2E Bank/ })).toContainText("US$200.00");
});

test("voiding an entry adds a reversal and restores the balance", async ({ page }) => {
  await signInAs(page, "owner");
  await record(page, "expense", { amount: "35", account: "E2E Cash", category: "Transport" });
  await confirm(page, "Void entry", "Void entry", "Entered by mistake");
  await expect(page.getByText("Void: Entered by mistake")).toBeVisible();
  await expect(page.getByRole("link", { name: "See the reversal" })).toBeVisible();
  await open(page, "/accounts");
  await expect(page.getByRole("row", { name: /E2E Cash/ })).toContainText("US$280.00");
});

test("an invoice is issued and partly paid into an account", async ({ page }) => {
  await signInAs(page, "owner");
  await open(page, "/invoices/new");
  const create = page.getByRole("form", { name: "New invoice" });
  await create.getByLabel("Customer").selectOption({ label: "Kollie Supermarket" });
  await create.getByLabel("Currency").selectOption("USD");
  await create.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Draft invoice" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  const line = page.getByRole("form", { name: "Add a line" });
  await line.getByLabel("Description").fill("Rice, 25 kg bags");
  await line.getByLabel("Quantity").fill("2");
  await line.getByLabel("Unit price (USD)").fill("150");
  await line.getByRole("button", { name: "Add line" }).click();
  await expect(page.getByRole("row", { name: /Rice, 25 kg bags/ })).toContainText("US$300.00");
  await confirm(page, "Issue invoice", "Issue invoice");
  await expect(page.getByRole("heading", { level: 1, name: /Invoice No\. \d+/ })).toBeVisible();

  const pay = page.getByRole("form", { name: "Record a payment" });
  await pay.getByLabel("Amount (USD)").fill("100");
  await pay.getByLabel("Method").selectOption({ label: "Mobile money" });
  await pay.getByLabel("Paid into").selectOption({ label: "E2E Bank" });
  await pay.getByLabel("Income category").selectOption({ label: "Sales" });
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(pay.getByText(/Payment recorded\. Receipt RCT-\d{6} issued\./)).toBeVisible();
  await expect(page.getByText("Part paid")).toBeVisible();
  await expect(page.getByRole("row", { name: /Balance due/ })).toContainText("US$200.00");
  const pdf = await page.request.get(
    (await page.getByRole("link", { name: "Invoice PDF" }).getAttribute("href")) ?? "",
  );
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});

test("payroll is prepared, approved by the Owner and marked paid", async ({ page }) => {
  await signInAs(page, "owner");
  await open(page, "/payroll");
  await page.getByRole("button", { name: "Prepare payroll" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Payroll: / })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("row", { name: /Korpo Wleh/ })).toContainText("US$486.50");
  await confirm(page, "Approve payroll", "Approve payroll");
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();

  const pay = page.getByRole("form", { name: "Mark payroll as paid" });
  await pay.getByLabel("Pay USD salaries from").selectOption({ label: "Bank account (USD)" });
  await pay.getByLabel("Pay LRD salaries from").selectOption({ label: "Mobile money (LRD)" });
  await pay.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByText(/^Paid \d/)).toBeVisible();
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  const slip = await page.request.get(
    (await page.getByRole("link", { name: "Payslip for Korpo Wleh" }).getAttribute("href")) ?? "",
  );
  expect(slip.headers()["content-type"]).toBe("application/pdf");
});

test("reports show the expected totals and export them", async ({ page }) => {
  await signInAs(page, "owner");
  // Paying payroll recorded one salary expense per currency.
  await open(page, "/transactions?type=expense");
  await expect(page.getByText(/^Payroll .* \(1 payslip\)$/)).toHaveCount(2);
  expect(await statementClosing(page, "E2E Cash")).toBe("US$280.00");
  expect(await statementClosing(page, "E2E Bank")).toBe("US$300.00");
  const excel = await page.request.get(
    (await page.getByRole("link", { name: "Download Excel" }).getAttribute("href")) ?? "",
  );
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");
  const pdf = await page.request.get(
    (await page.getByRole("link", { name: "Download PDF" }).getAttribute("href")) ?? "",
  );
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  await open(page, "/reports?report=payroll");
  await expect(page.getByRole("row", { name: /Total USD/ })).toContainText("US$486.50");
});

test("Staff record entries but cannot reach payroll, reports or exports (FIN-07)", async ({
  page,
}) => {
  await signInAs(page, "staff");
  const nav = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  await expect(nav.getByRole("link", { name: "Payroll" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Reports" })).toHaveCount(0);
  await record(page, "expense", { amount: "12.50", account: "Cash box", category: "Supplies" });
  for (const path of ["/payroll", "/reports", "/reports/export?format=xlsx", "/settings"]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  await open(page, "/transactions");
  await expect(page.getByRole("link", { name: "Supplies" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Rent" })).toHaveCount(0);
});
