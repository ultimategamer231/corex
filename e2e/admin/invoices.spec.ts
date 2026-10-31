// Invoices, payments and receipts in Corex Admin (SPEC-ADMIN.md 9): a milestone invoice
// with a discount, sent, part paid and paid; custom drafts; voids; settings. On the
// fixture's invoices (packages/db/src/fixtures/admin.ts); tests run in order.
import { expect, type Page, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  setWidth,
  widths,
} from "../helpers";
import { open, OWNER_STATE } from "./helpers";

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

async function openClient(page: Page, name: string) {
  await open(page, `/clients?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function confirm(page: Page, trigger: string | RegExp, button: string, reason?: string) {
  await page.getByRole("button", { name: trigger }).click();
  const dialog = page.getByRole("dialog");
  if (reason) await dialog.getByLabel(/Why is it voided/).fill(reason);
  await dialog.getByRole("button", { name: button }).click();
  await expect(dialog).toBeHidden();
}

test("a milestone invoice with a discount is sent, part paid and paid (INV, PAY)", async ({
  page,
}) => {
  await openClient(page, "Hope Medical Center");
  await page.getByRole("link", { name: "Create invoice for milestone 2" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "New milestone invoice" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  const form = page.getByRole("form", { name: "Invoice draft" });
  await expect(form.getByLabel("Line 1 description")).toHaveValue("Milestone 2 of 3 (30%)");
  await expect(form.getByLabel("Unit price (USD)")).toHaveValue("750.00");
  await form.getByLabel("Type").selectOption("percent");
  await form.getByLabel("Percent").fill("10");
  await form.getByLabel(/Reason \(internal/).fill("Paid the first milestone early");
  const totals = page.getByRole("region", { name: "Totals" });
  await expect(totals).toContainText("-US$75.00");
  await expect(totals).toContainText("US$675.00");
  await form.getByRole("button", { name: "Save draft" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Draft invoice" })).toBeVisible({
    timeout: 15_000,
  });
  const preview = page.getByRole("article", { name: "Invoice preview" });
  await expect(preview).toContainText("Number assigned on sending");
  await expect(preview).not.toContainText("Paid the first milestone early");
  await expect(page.getByText(/Discount reason \(internal\)/)).toBeVisible();

  await confirm(page, "Send invoice", "Send invoice");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/^CX-\d{2}-\d{2}-\d{3}$/);
  await expect(page.getByText("Sent", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit draft" })).toHaveCount(0);

  await page.getByRole("button", { name: "Record payment" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (USD)").fill("700");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog.getByText("The payment is more than the balance due")).toBeVisible();
  await dialog.getByLabel("Amount (USD)").fill("300");
  await dialog.getByLabel("Method").selectOption("mtn_momo");
  await dialog.getByLabel("Reference").fill("MM-88123");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Partly paid").first()).toBeVisible();
  const payments = page.getByRole("list", { name: "Payments" });
  await expect(payments).toContainText(/RC-\d{2}-\d{2}-\d{3}/);
  await expect(payments).toContainText("MTN Mobile Money · MM-88123");

  await page.getByRole("button", { name: "Record payment" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Amount (USD)")).toHaveValue("375.00");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);

  const lastVoid = page.getByRole("button", { name: /Void payment RC-/ }).last();
  const label = (await lastVoid.textContent()) ?? "";
  await confirm(page, label, "Void payment", "Client's transfer was reversed");
  await expect(page.getByText("Partly paid").first()).toBeVisible();
  await expect(payments).toContainText("Void: Client's transfer was reversed");
});

test("custom drafts check the discount, and drafts can be deleted", async ({ page }) => {
  await open(page, "/invoices/new");
  const form = page.getByRole("form", { name: "Invoice draft" });
  await form.getByRole("combobox", { name: "Client" }).selectOption({ label: "Riverside Traders" });
  await form.getByLabel("Line 1 description").fill("Extra training day");
  await form.getByLabel("Unit price (USD)").fill("150");
  await form.getByRole("button", { name: "Add line" }).click();
  await form.getByLabel("Line 2 description").fill("Travel");
  await form.getByLabel("Quantity").nth(1).fill("2");
  await form.getByLabel("Unit price (USD)").nth(1).fill("25");
  await form.getByLabel("Type").selectOption("fixed");
  await form.getByLabel("Amount (USD)").fill("500");
  await expect(page.getByText("The discount is more than the subtotal")).toBeVisible();
  await form.getByRole("button", { name: "Save draft" }).click();
  await expect(form.getByText("The discount cannot be more than the subtotal")).toBeVisible();
  await form.getByLabel("Amount (USD)").fill("20");
  await expect(page.getByRole("region", { name: "Totals" })).toContainText("US$180.00");
  await form.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Draft invoice" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Invoices and receipts" })).toBeVisible({
    timeout: 15_000,
  });
});

test("overdue invoices are found, owed on the clients list, and voided with a reason (INV-06)", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await open(page, "/clients");
  const row = page
    .getByRole("region", { name: "Clients" })
    .getByRole("row", { name: /Bright Future NGO/ });
  await expect(row).toContainText("US$300.00");

  await open(page, "/invoices?status=overdue");
  const table = page.getByRole("region", { name: "Invoices" });
  await expect(table.getByRole("row", { name: /Bright Future NGO/ })).toContainText("Overdue");
  await table.getByRole("link", { name: /CX-/ }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Void invoice" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Void invoice" }).click();
  await expect(dialog.getByText(/Say why/)).toBeVisible();
  await dialog.getByLabel(/Why is it voided/).fill("Renewal amount agreed again");
  await dialog.getByRole("button", { name: "Void invoice" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Renewal amount agreed again/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveClass(/line-through/);

  await open(page, "/invoices?tab=receipts");
  await expect(page.getByRole("region", { name: "Receipts" })).toContainText("Hope Medical Center");
});

async function expectPdf(page: Page, path: string) {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
}

test("invoice, receipt and quote PDFs download (SPEC-ADMIN.md 9.4)", async ({ page }) => {
  await open(page, "/invoices?status=paid");
  await page.getByRole("link", { name: /CX-/ }).first().click();
  await page.waitForLoadState("networkidle");
  const invoicePdf = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  await expectPdf(page, invoicePdf ?? "");
  const receiptPdf = await page
    .getByRole("link", { name: /Download receipt/ })
    .first()
    .getAttribute("href");
  await expectPdf(page, receiptPdf ?? "");

  await open(page, `/leads?q=${encodeURIComponent("St. Peter's College")}`);
  await page
    .getByRole("link", { name: /St\. Peter's College/ })
    .first()
    .click();
  await page.waitForLoadState("networkidle");
  const quotePdf = await page
    .getByRole("link", { name: "Download quote PDF" })
    .first()
    .getAttribute("href");
  await expectPdf(page, quotePdf ?? "");
});

test("client view link: shown once, opens signed out, replaced by a new one (LINK)", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(240_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setWidth(page, 1440);
  await open(page, "/invoices?status=paid");
  await page.getByRole("link", { name: /CX-/ }).first().click();
  await page.waitForLoadState("networkidle");
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText(/^CX-/);
  const number = (await title.textContent()) ?? "";

  const email = page.getByRole("button", { name: "Email" });
  await expect(email).toBeDisabled();
  await expect(
    page.getByText("Verify the sending domain in Settings to email clients."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create client view link" }).click();
  const field = page.getByRole("textbox", { name: "Client view link" });
  await expect(field).toHaveValue(/\/i\/[A-Za-z0-9_-]{40,60}$/, { timeout: 15_000 });
  const first = await field.inputValue();
  await page.getByRole("button", { name: "Copy for WhatsApp" }).click();
  await expect(page.getByText("Copied.")).toBeVisible();
  const message = await page.evaluate(() => navigator.clipboard.readText());
  expect(message).toContain(`invoice ${number}`);
  expect(message).toContain(first);

  const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const client = await visitor.newPage();
  try {
    await open(client, first);
    await expect(
      client.getByRole("heading", { level: 1, name: `Invoice ${number}` }),
    ).toBeVisible();
    await expect(client.getByText(/Balance due/)).toBeVisible();
    await expect(client.getByRole("article", { name: "Invoice preview" })).toContainText(number);
    await expectPdf(client, `${new URL(first).pathname}/pdf`);
    for (const width of widths) {
      await setWidth(client, width);
      await open(client, first);
      await expectNoSeriousA11yViolations(client);
      await expectNoHorizontalOverflow(client);
      await expectTouchTargets(client);
    }

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/A client view link exists until/)).toBeVisible();
    await page.getByRole("button", { name: "New client view link" }).click();
    await expect(field).toHaveValue(/\/i\//, { timeout: 15_000 });
    const second = await field.inputValue();
    expect(second).not.toBe(first);
    for (const width of widths) {
      await setWidth(page, width);
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
    }

    await open(client, first);
    await expect(client.getByText("This link is no longer valid. Contact Corex.")).toBeVisible();
    expect((await client.request.get(`${new URL(first).pathname}/pdf`)).status()).toBe(404);
    await open(client, "/i/not-a-real-link");
    await expect(client.getByText("This link is no longer valid. Contact Corex.")).toBeVisible();
    await open(client, second);
    await expect(
      client.getByRole("heading", { level: 1, name: `Invoice ${number}` }),
    ).toBeVisible();
    // The client view shows nothing of the admin app.
    await expect(client.getByRole("navigation")).toHaveCount(0);
  } finally {
    await visitor.close();
  }
});

test("invoicing settings: payment terms and tax apply to new drafts", async ({ page }) => {
  await open(page, "/settings/invoicing");
  const form = page.getByRole("form", { name: "Invoicing settings" });
  await expect(form.getByLabel("Payment terms (days)")).toHaveValue("7");
  await form.getByLabel(/Charge tax/).check();
  await form.getByLabel("Rate (%)").fill("10");
  await form.getByLabel("Name on invoices").fill("GST");
  await form.getByRole("button", { name: "Save invoicing settings" }).click();
  await expect(form.getByText(/Invoicing settings saved/)).toBeVisible();

  await open(page, "/invoices/new");
  const draft = page.getByRole("form", { name: "Invoice draft" });
  await draft.getByLabel("Line 1 description").fill("Consulting");
  await draft.getByLabel("Unit price (USD)").fill("100");
  await expect(page.getByRole("region", { name: "Totals" })).toContainText("GST (10%)");
  await expect(page.getByRole("region", { name: "Totals" })).toContainText("US$110.00");

  await open(page, "/settings/invoicing");
  await form.getByLabel(/Charge tax/).uncheck();
  await form.getByRole("button", { name: "Save invoicing settings" }).click();
  await expect(form.getByText(/Invoicing settings saved/)).toBeVisible();
});

test("invoice pages pass at every width", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "/invoices?status=paid");
  const paid = await page.getByRole("link", { name: /CX-/ }).first().getAttribute("href");
  await open(page, "/invoices?status=draft");
  const draft = await page.getByRole("link", { name: "Draft" }).first().getAttribute("href");
  for (const path of [
    "/invoices",
    "/invoices?tab=receipts",
    "/invoices/new",
    paid ?? "/invoices",
    draft ?? "/invoices",
    `${draft ?? "/invoices"}/edit`,
    "/settings/company",
    "/settings/invoicing",
  ]) {
    for (const width of widths) {
      await setWidth(page, width);
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
    }
  }
});
