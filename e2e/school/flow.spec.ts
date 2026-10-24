// SPEC.md 7.6 end-to-end flow, College edition: new student, enrollment, course plan
// approved, scores, approval, lock and PDF; then fees in LRD with a receipt.
import { expect, type Page, test } from "@playwright/test";
import { confirm, open, signIn, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36).slice(-5);
const student = {
  first: "Musu",
  last: `Flomo${suffix}`,
  email: `musu.${suffix}@e2e-college.corex.test`,
};
let temporaryPassword = "";
let studentUrl = "";

async function openStudent(page: Page) {
  await open(page, studentUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: `${student.first} ${student.last}` }),
  ).toBeVisible();
}

test("the Registrar admits a student and is warned about a likely duplicate", async ({ page }) => {
  await signInAs(page, "registrar");
  await open(page, "/students/new");
  // Same name and date of birth as the fixture student.
  const person = page.getByRole("group", { name: "Student" });
  await person.getByRole("textbox", { name: "First name" }).fill("Ama");
  await person.getByRole("textbox", { name: "Last name" }).fill("Kpadeh");
  await person.getByLabel("Date of birth").fill("2004-05-01");
  await page
    .getByRole("combobox", { name: "Program", exact: true })
    .selectOption({ label: "BSC-CS Bachelor of Science in Computing" });
  await page.getByRole("button", { name: "Admit student" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /different person/ })).toBeVisible();

  await person.getByRole("textbox", { name: "First name" }).fill(student.first);
  await person.getByRole("textbox", { name: "Last name" }).fill(student.last);
  await page.getByRole("button", { name: "Admit student" }).click();
  await expect(page.getByText(/Student admitted with number SC-\d{4}-\d{4}/)).toBeVisible();
  studentUrl = new URL(page.url()).pathname;
  await expect(page.getByText("BSC-CS Bachelor of Science in Computing").first()).toBeVisible();
});

test("the Super Admin creates the student's portal sign-in", async ({ page }) => {
  await signInAs(page, "super_admin");
  await openStudent(page);
  await page.getByRole("textbox", { name: "Student email" }).fill(student.email);
  await page.getByRole("button", { name: "Create sign-in" }).click();
  const message = page.getByRole("status").filter({ hasText: "Temporary password" });
  await expect(message).toBeVisible();
  temporaryPassword =
    /Temporary password: (\S+)/.exec((await message.textContent()) ?? "")?.[1] ?? "";
  expect(temporaryPassword).toMatch(/^Cx/);
});

test("the student plans courses; prerequisites are enforced", async ({ page }) => {
  await signIn(page, student.email, temporaryPassword);
  await open(page, "/planning");
  await page.getByRole("button", { name: "Add MATH 201" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "MATH 201 needs MATH 101 first" }),
  ).toBeVisible();
  const offered = page.getByRole("region", { name: "Courses offered this term" }).first();
  await page.getByRole("button", { name: "Add ENG 101" }).click();
  await expect(offered.getByRole("row", { name: /ENG 101/ })).toContainText("In your plan");
  await page.getByRole("button", { name: "Add PHY 101" }).click();
  await expect(offered.getByRole("row", { name: /PHY 101/ })).toContainText("In your plan");
  await expect(page.getByRole("region", { name: "My plan" }).first()).toContainText("PHY 101");
  await page.getByRole("button", { name: "Submit plan to the Registrar" }).click();
  await expect(page.getByText(/Plan submitted to the Registrar/)).toBeVisible();
  await expect(page.getByText("Your plan is with the Registrar")).toBeVisible();
});

test("the Registrar approves the plan", async ({ page }) => {
  await signInAs(page, "registrar");
  await open(page, "/registration");
  const plan = page
    .getByRole("region", { name: new RegExp(`${student.first} ${student.last}`) })
    .or(page.locator("section").filter({ hasText: `${student.first} ${student.last}` }));
  await plan
    .first()
    .getByRole("button", { name: /Approve all/ })
    .click();
  await expect(page.getByText(`${student.first} ${student.last}`)).toBeHidden();
});

test("the instructor enters and submits scores for their class", async ({ page }) => {
  await signInAs(page, "instructor");
  await open(page, "/grades");
  await page.getByRole("link", { name: /Open ENG 101/ }).click();
  await page.getByRole("textbox", { name: "Assessment" }).fill("Final exam");
  await page.getByRole("spinbutton", { name: "Weight (%)" }).fill("100");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Final exam added.")).toBeVisible();
  await page.getByLabel(`Final exam for ${student.first} ${student.last}`).fill("88");
  await page.getByRole("button", { name: "Save scores" }).click();
  await expect(page.getByText(/scores? saved/)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(student.last) })).toContainText("88.00");
  await confirm(page, "Submit grades", "Submit grades");
  await expect(page.getByText(/Grades are submitted/)).toBeVisible();
});

test("the Registrar approves and locks the grades", async ({ page }) => {
  await signInAs(page, "registrar");
  await open(page, "/grades");
  await page
    .getByRole("region", { name: "Classes" })
    .first()
    .getByRole("link", { name: /Open ENG 101/ })
    .click();
  await confirm(page, "Approve grades", "Approve");
  await expect(page.getByText(/Grades are approved/)).toBeVisible();
  await confirm(page, "Lock and publish", "Lock grades");
  await expect(page.getByText(/Grades are locked/)).toBeVisible();
});

test("the student sees the published grade and downloads the transcript", async ({ page }) => {
  await signIn(page, student.email, temporaryPassword);
  await open(page, "/grades");
  await expect(page.getByRole("row", { name: /ENG 101/ })).toContainText("B");
  const href = await page.getByRole("link", { name: "Download transcript" }).getAttribute("href");
  const response = await page.request.get(href ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("the Bursar invoices the term and records a partial payment in LRD", async ({ page }) => {
  await signInAs(page, "bursar");
  await open(page, "/fees");
  await page.getByRole("button", { name: "Issue invoices" }).click();
  await expect(page.getByText(/invoices? issued|already has an invoice/)).toBeVisible();
  await open(page, `/fees/invoices?student=${studentUrl.split("/").pop() ?? ""}`);
  const lrd = page.getByRole("row", { name: /L\$45,000\.00/ });
  await lrd.getByRole("link").click();
  await page.getByRole("textbox", { name: "Amount (LRD)" }).fill("20,000");
  await page.getByRole("combobox", { name: "Paid by" }).selectOption("mobile_money");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Receipt RCT-\d{6} issued/)).toBeVisible();
  await expect(page.getByText("Balance due L$25,000.00")).toBeVisible();
  const receipt = await page
    .getByRole("link", { name: /RCT-\d{6}/ })
    .first()
    .getAttribute("href");
  const pdf = await page.request.get(receipt ?? "");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});
