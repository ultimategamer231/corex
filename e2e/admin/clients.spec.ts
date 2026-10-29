// Clients in Corex Admin (SPEC-ADMIN.md 8.2): LEAD-06 conversion, derived statuses,
// deployment and subscription, contacts and private documents, on the fixture's clients
// (packages/db/src/fixtures/admin.ts). Tests change those records, so they run in order.
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

/** A tab of the client page (the sidebar has links with similar names). */
function tabs(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Client sections" })
    .getByRole("link", { name, exact: true });
}

async function openClient(page: Page, name: string) {
  await open(page, `/clients?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("a lead converts once into a client with contract, deployment and subscription (LEAD-06)", async ({
  page,
}) => {
  await open(page, "/leads?q=Paynesville");
  await page
    .getByRole("link", { name: /Paynesville Women's Cooperative/ })
    .first()
    .click();
  await page.getByRole("link", { name: "Convert to client" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Convert to client" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  const form = page.getByRole("form", { name: "Convert to client" });
  await expect(form.getByLabel("Name").first()).toHaveValue("Paynesville Women's Cooperative");
  await form.getByRole("button", { name: "Convert to client" }).click();
  await expect(form.getByText("Enter the contract amount")).toBeVisible();

  await form.getByLabel("City").fill("Paynesville");
  await form.getByLabel("Contract amount").fill("1,200");
  await form.getByRole("button", { name: "Convert to client" }).click();
  await expect(form.getByText("Enter the yearly renewal for the Managed plan")).toBeVisible();
  await form.getByLabel(/Yearly renewal/).fill("300");
  await form.getByLabel("Signing date").fill("2026-10-20");
  await form.getByRole("button", { name: "Convert to client" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Paynesville Women's Cooperative" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Setting up").first()).toBeVisible();
  await expect(page.getByText(/Contract CT-26-10-\d{3}/)).toBeVisible();
  const milestones = page.getByRole("list", { name: "Milestones" });
  await expect(milestones.getByText("US$600.00")).toBeVisible();
  await expect(milestones.getByText("US$360.00")).toBeVisible();
  await expect(milestones.getByText("US$240.00")).toBeVisible();

  await page.getByRole("link", { name: "Original lead" }).click();
  await expect(page.getByRole("link", { name: "Open client" })).toBeVisible();
  await expect(page.getByText("Stage changed from New to Won.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Convert to client" })).toHaveCount(0);
});

test("statuses are derived and grouped in the list's tabs", async ({ page }) => {
  await setWidth(page, 1440);
  await open(page, "/clients");
  const table = page.getByRole("region", { name: "Clients" });
  const row = (name: string) => table.getByRole("row").filter({ hasText: name });
  await expect(row("Hope Medical Center")).toContainText("Setting up");
  await expect(row("Riverside Traders")).toContainText("Renewal due");
  await expect(row("Bright Future NGO")).toContainText("Grace period");
  await expect(row("Lakeside Institute")).toContainText("In warranty");

  await page.getByRole("link", { name: /Renewal due or overdue/ }).click();
  await expect(row("Riverside Traders")).toBeVisible();
  await expect(row("Bright Future NGO")).toBeVisible();
  await expect(row("Hope Medical Center")).toHaveCount(0);
});

test("going live starts the subscription; contacts and documents are kept", async ({ page }) => {
  await openClient(page, "Hope Medical Center");
  await page.getByRole("button", { name: "Edit deployment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("State").selectOption("live");
  await dialog.getByLabel("Went live on").fill("2026-10-20");
  await dialog.getByLabel("App address").fill("hope-clinic.example.com");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Active").first()).toBeVisible();
  await expect(page.getByText("20 Oct 2027")).toBeVisible();
  await expect(page.getByText(/5× the hosting cost, above your 3× minimum/)).toBeVisible();

  await tabs(page, "Contacts").click();
  await page.getByRole("button", { name: "Add contact" }).click();
  const contact = page.getByRole("dialog");
  await contact.getByLabel("Name").fill("Joseph Bility");
  await contact.getByLabel("Role").fill("Accounts officer");
  await contact.getByLabel("Email").fill("billing@hopemedical.example");
  await contact.getByLabel(/Billing contact/).check();
  await contact.getByRole("button", { name: "Save" }).click();
  await expect(contact).toBeHidden();
  const contacts = page.getByRole("list", { name: "Contacts" });
  await expect(contacts.getByRole("listitem").filter({ hasText: "Joseph Bility" })).toContainText(
    "Billing",
  );
  await expect(contacts.getByRole("listitem").filter({ hasText: "Esther Dolo" })).not.toContainText(
    "Billing",
  );
  await expect(page.getByRole("button", { name: "Remove Esther Dolo" })).toHaveCount(0);

  await tabs(page, "Documents").click();
  await page.getByLabel("Add a document").setInputFiles({
    name: "Signed contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Corex test document\n%%EOF\n"),
  });
  await page.getByRole("button", { name: "Upload" }).click();
  const documents = page.getByRole("list", { name: "Documents" });
  await expect(
    documents.getByRole("paragraph").filter({ hasText: "Signed contract.pdf" }),
  ).toBeVisible({
    timeout: 15_000,
  });
  const href = await documents.getByRole("link", { name: /Download/ }).getAttribute("href");
  const response = await page.request.get(href ?? "", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toContain("/storage/v1/object/sign/");

  await page.getByLabel("Add a document").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not allowed"),
  });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Upload a PDF, JPG or PNG file.")).toBeVisible();

  await page.getByRole("button", { name: "Remove Signed contract.pdf" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(documents).toHaveCount(0);

  await tabs(page, "Activity").click();
  await expect(page.getByText("Changed deployment").first()).toBeVisible();
  await expect(page.getByText("Added client contact").first()).toBeVisible();
});

test("a Handover client can be added without a lead", async ({ page }) => {
  await open(page, "/clients/new");
  const form = page.getByRole("form", { name: "New client" });
  await form.getByLabel("Name").first().fill("Gbarnga Polytechnic");
  await form.getByLabel("Name").nth(1).fill("Rebecca Kollie");
  await form.getByLabel("Email").fill("registrar@gbarnga.example");
  await form.getByLabel("Product").selectOption("school_college");
  await form.getByLabel("Plan").selectOption("handover");
  await expect(form.getByLabel(/Yearly renewal/)).toHaveCount(0);
  await form.getByLabel("Contract amount").fill("3,000");
  await form.getByLabel("Payment split (%)").fill("40/30/30");
  await form.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gbarnga Polytechnic" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Handover plan: the client hosts the system/)).toBeVisible();
  const milestones = page.getByRole("list", { name: "Milestones" });
  await expect(milestones.getByText("US$1,200.00")).toBeVisible();
  await expect(milestones.getByText("US$900.00")).toHaveCount(2);
});

test("client pages pass at every width", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "/clients?q=Riverside");
  const href = await page
    .getByRole("link", { name: /Riverside Traders/ })
    .first()
    .getAttribute("href");
  await open(page, "/leads?q=Musu");
  const lead = await page
    .getByRole("link", { name: /Greenfield Academy/ })
    .first()
    .getAttribute("href");
  const client = href ?? "/clients";
  for (const path of [
    "/clients",
    "/clients/new",
    client,
    `${client}?tab=contacts`,
    `${client}?tab=documents`,
    `${client}?tab=activity`,
    `${lead ?? "/leads"}/convert`,
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
