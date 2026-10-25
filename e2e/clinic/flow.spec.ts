// SPEC.md 8.5: register patient, book appointment, check in, nurse vitals, clinician
// note signed, cashier invoice, partial payment, receipt. Also the duplicate flag
// (CLN-08), double booking (CLN-04), note corrections (CLN-03) and clinical privacy
// through direct URLs (CLN-01).
import { expect, type Page, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../helpers";
import { confirm, open, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

// A 1x1 PNG, as a lab result photo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const PATIENT = { first: "Esther", last: "Flomo", dob: "1990-05-14", phone: "0886 123 456" };
let patientUrl = "";
let encounterUrl = "";

async function register(page: Page) {
  await open(page, "/patients/new");
  const form = page.getByRole("form", { name: "Register patient" });
  await form.getByRole("textbox", { name: "First name" }).fill(PATIENT.first);
  await form.getByRole("textbox", { name: "Last name" }).fill(PATIENT.last);
  await form.getByRole("combobox", { name: "Sex" }).selectOption("female");
  await form.getByLabel("Date of birth").fill(PATIENT.dob);
  await form.getByRole("textbox", { name: "Phone", exact: true }).fill(PATIENT.phone);
  await form.getByRole("combobox", { name: "Allergies" }).selectOption("yes");
  await form.getByRole("textbox", { name: "Allergy details" }).fill("Sulfa drugs");
  await form.getByRole("button", { name: "Register patient" }).click();
  await expect(page.getByText(/Patient registered as PT-\d{4}-\d{5}/)).toBeVisible();
}

async function book(page: Page, search: string, choose: RegExp, time: string) {
  await open(page, "/appointments/new");
  await page.getByRole("searchbox", { name: "Find a patient" }).fill(search);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: choose }).first().click();
  const form = page.getByRole("form", { name: "Book appointment" });
  await expect(form).toBeVisible();
  await page.waitForLoadState("networkidle");
  await form
    .getByRole("combobox", { name: "Clinician" })
    .selectOption({ label: "Dr. Samuel Dolo" });
  await form.getByLabel("Time").fill(time);
  await form.getByRole("textbox", { name: "Reason" }).fill("Fever for three days");
  await form.getByRole("button", { name: "Book appointment" }).click();
}

test("the Receptionist registers a patient and a duplicate is flagged", async ({ page }) => {
  await signInAs(page, "receptionist");
  await register(page);
  patientUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("note")).toContainText("Allergies: Sulfa drugs");
  // The same name and date of birth again: registered, but flagged (CLN-08).
  await register(page);
  await expect(page.getByText(/Possible duplicate of/)).toBeVisible();
});

test("the Receptionist books, a clash is refused, and the patient is checked in", async ({
  page,
}) => {
  await signInAs(page, "receptionist");
  await book(page, "Flomo", /^Choose Esther Flomo$/, "22:00");
  await expect(page.getByText("Appointment booked.")).toBeVisible();
  // Another patient at an overlapping time with the same clinician (CLN-04).
  await book(page, "Kamara", /^Choose Kebeh Kamara$/, "22:10");
  await expect(
    page.getByText(
      "This clinician already has an appointment from 22:00 to 22:20. Choose another time.",
    ),
  ).toBeVisible();

  await open(page, "/appointments");
  const card = page.getByRole("listitem").filter({ hasText: "22:00 to 22:20" });
  await card.getByRole("button", { name: "Check in" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Check in", exact: true }).click();
  await expect(card.getByText("Checked in")).toBeVisible();
  await open(page, "/queue");
  await expect(page.getByRole("link", { name: "Esther Flomo" }).first()).toBeVisible();
});

test("the Nurse records intake vitals", async ({ page }) => {
  await signInAs(page, "nurse");
  await open(page, "/queue");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Esther Flomo" })
    .getByRole("link", { name: "Take vitals" })
    .click();
  await expect(page.getByRole("note")).toContainText("Allergies: Sulfa drugs");
  await page.waitForLoadState("networkidle");
  const form = page.getByRole("form", { name: "Record vitals" });
  await form.getByRole("textbox", { name: "Temperature (°C)" }).fill("38.4");
  await form.getByRole("textbox", { name: "Pulse (per minute)" }).fill("96");
  await form.getByRole("textbox", { name: "Blood pressure, systolic" }).fill("118");
  await form.getByRole("textbox", { name: "Blood pressure, diastolic" }).fill("76");
  await form.getByRole("button", { name: "Save vitals" }).click();
  await expect(page.getByText("Vitals recorded.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "118/76" })).toBeVisible();
});

test("the Clinician opens the visit, signs a note and corrects it", async ({ page }) => {
  await signInAs(page, "clinician");
  await open(page, "/queue");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Esther Flomo" })
    .getByRole("button", { name: "Start visit" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Visit: Esther Flomo" })).toBeVisible();
  encounterUrl = new URL(page.url()).pathname;
  // Intake vitals belong to the visit.
  await expect(page.getByRole("cell", { name: "38.4" })).toBeVisible();

  await page.waitForLoadState("networkidle");
  const form = page.getByRole("form", { name: "New note" });
  await form.getByRole("textbox", { name: "Presenting complaints" }).fill("Fever and headache");
  await form.getByRole("textbox", { name: "Assessment (diagnosis)" }).fill("Suspected malaria");
  await form.getByRole("textbox", { name: "Plan" }).fill("Malaria rapid test");
  await form.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await confirm(page, "Sign note", "Sign note");
  await expect(page.getByText(/Version 1, signed by Dr\. Samuel Dolo/)).toBeVisible();

  // A correction is a new version; the signed one stays in the history (CLN-03).
  await confirm(page, "Add a correction", "Start correction");
  const draft = page.getByRole("form", { name: "Draft note, version 2" });
  await expect(draft).toBeVisible();
  await draft
    .getByRole("textbox", { name: "Assessment (diagnosis)" })
    .fill("Malaria, confirmed by RDT");
  await draft.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await confirm(page, "Sign note", "Sign note");
  await expect(page.getByText(/Version 2, signed by Dr\. Samuel Dolo/)).toBeVisible();
  await page.getByText("Version history (2 versions)").click();
  await expect(
    page.getByText(/Version 1 by Dr\. Samuel Dolo: signed .*, corrected by version 2/),
  ).toBeVisible();

  await expectNoSeriousA11yViolations(page);
  await confirm(page, "Close visit", "Close visit");
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
});

test("the Clinician attaches a file and opens it through a short-lived link (CLN-06)", async ({
  page,
}) => {
  await signInAs(page, "clinician");
  await open(page, patientUrl);
  const form = page.getByRole("form", { name: "Attach a file" });
  await form
    .getByLabel(/^File/)
    .setInputFiles({ name: "lab.png", mimeType: "image/png", buffer: PNG });
  await form.getByRole("button", { name: "Attach file" }).click();
  await expect(form.getByText("lab.png attached.")).toBeVisible();
  const link = page.getByRole("link", { name: /^Image added/ });
  const href = (await link.getAttribute("href")) ?? "";
  const file = await page.request.get(href, { maxRedirects: 0 });
  expect(file.status()).toBe(307);
  expect(file.headers()["location"]).toMatch(
    /\/storage\/v1\/object\/sign\/.*patients\/[0-9a-f-]+\/.*\.png\?token=/,
  );
  // A text file is refused.
  await form
    .getByLabel(/^File/)
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await form.getByRole("button", { name: "Attach file" }).click();
  await expect(form.getByText("Attach a PDF, JPG or PNG file.")).toBeVisible();
});

test("the Receptionist and Cashier cannot open clinical records (CLN-01)", async ({ page }) => {
  for (const role of ["receptionist", "cashier"] as const) {
    await signInAs(page, role);
    const response = await page.goto(encounterUrl);
    expect(response?.status()).toBe(404);
    await open(page, patientUrl);
    await expect(page.getByRole("heading", { name: "Recent vitals" })).toHaveCount(0);
    await expect(page.getByText("Suspected malaria")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Files" })).toHaveCount(0);
    await page.context().clearCookies();
  }
});

test("the Cashier bills the visit, takes a partial payment and prints the receipt", async ({
  page,
}) => {
  await signInAs(page, "cashier");
  await open(page, "/billing");
  await page
    .getByRole("row", { name: /Esther Flomo/ })
    .getByRole("link", { name: "Bill this visit" })
    .first()
    .click();
  const bill = page.getByRole("form", { name: "New bill" });
  await expect(bill).toBeVisible();
  await page.waitForLoadState("networkidle");
  await bill.getByRole("button", { name: "Create bill" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Draft bill" })).toBeVisible();

  const add = async (service: RegExp) => {
    const form = page.getByRole("form", { name: "Add a service" });
    await form
      .getByRole("combobox", { name: "Service" })
      .selectOption({ label: await optionLabel(page, service) });
    await form.getByRole("button", { name: "Add service" }).click();
    await expect(form.getByText(/added\.$/)).toBeVisible();
  };
  await add(/^Consultation/);
  await add(/^Malaria rapid test/);
  // The total is the sum of the service lines (CLN-07).
  await expect(page.getByRole("row", { name: /^Total/ })).toContainText("US$20.00");
  await confirm(page, "Issue bill", "Issue bill");
  await expect(page.getByRole("heading", { level: 1, name: /^Bill No\. \d+$/ })).toBeVisible();

  await page.waitForLoadState("networkidle");
  const pay = page.getByRole("form", { name: "Record a payment" });
  await pay.getByRole("textbox", { name: /Amount/ }).fill("5");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Payment recorded\. Receipt RCT-\d{6} issued\./)).toBeVisible();
  await expect(page.getByRole("row", { name: /Balance due/ })).toContainText("US$15.00");
  await expectNoSeriousA11yViolations(page);

  const receipt = page.getByRole("link", { name: /^RCT-\d{6}$/ });
  const pdf = await page.request.get((await receipt.getAttribute("href")) ?? "");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // The daily cash report counts the payment.
  await open(page, "/reports");
  await expect(page.getByRole("row", { name: /^Total/ })).toContainText("US$5.00");
  for (const format of ["pdf", "xlsx"]) {
    const href =
      (await page
        .getByRole("link", { name: format === "pdf" ? "Download PDF" : "Download Excel" })
        .getAttribute("href")) ?? "";
    expect(href).toContain(`format=${format}`);
    expect((await page.request.get(href)).status()).toBe(200);
  }
});

async function optionLabel(page: Page, pattern: RegExp): Promise<string> {
  const labels = await page
    .getByRole("form", { name: "Add a service" })
    .getByRole("option")
    .allTextContents();
  const label = labels.find((l) => pattern.test(l));
  if (!label) throw new Error(`No service matches ${pattern}`);
  return label;
}
