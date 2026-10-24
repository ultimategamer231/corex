// SPEC.md 7.6 end-to-end flow, High School edition: new student, placement, scores,
// approval, lock and report card PDF; parent portal and section attendance.
import { expect, test } from "@playwright/test";
import { confirm, open, signInAs } from "../school/helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36).slice(-5);
const student = { first: "Garmai", last: `Flomo${suffix}` };
let studentPath = "";

test("the Registrar admits a student into Grade 11 A", async ({ page }) => {
  await signInAs(page, "registrar");
  await open(page, "/students/new");
  const person = page.getByRole("group", { name: "Student" });
  await person.getByRole("textbox", { name: "First name" }).fill(student.first);
  await person.getByRole("textbox", { name: "Last name" }).fill(student.last);
  await page
    .getByRole("combobox", { name: "Grade and section" })
    .selectOption({ label: "Grade 11 A" });
  await page.getByRole("button", { name: "Admit student" }).click();
  await expect(page.getByText(/Student admitted with number SC-\d{4}-\d{4}/)).toBeVisible();
  await expect(page.getByText("Grade 11 A").first()).toBeVisible();
  studentPath = new URL(page.url()).pathname;
});

test("the homeroom teacher records the section's attendance", async ({ page }) => {
  await signInAs(page, "teacher");
  await open(page, "/attendance");
  await page.getByRole("combobox", { name: "Class" }).selectOption({ label: "Grade 11 A" });
  await page.getByRole("button", { name: "Open register" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: `absent - ${student.first} ${student.last}` }).check();
  await page.getByRole("button", { name: "Save register" }).click();
  await expect(page.getByText(/Attendance saved for \d+ students/)).toBeVisible();
});

test("the teacher enters and submits Period 1 Mathematics scores", async ({ page }) => {
  await signInAs(page, "teacher");
  await open(page, "/grades");
  await page.getByRole("link", { name: "Grade 11 A · Mathematics" }).click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1, name: "Grade 11 A · Mathematics" }),
  ).toBeVisible();
  for (const [name, score] of [
    ["Kebeh Doe", "88"],
    ["Sando Kamara", "71"],
    [`${student.first} ${student.last}`, "76.5"],
  ] as const) {
    await page.getByRole("spinbutton", { name: `Period 1 score for ${name}` }).fill(score);
  }
  await page.getByRole("button", { name: "Save scores" }).click();
  await expect(page.getByText("3 scores saved.")).toBeVisible();
  await confirm(page, "Submit Period 1", "Submit scores");
  await expect(page.getByText("Period 1 scores are submitted")).toBeVisible();
});

test("the Registrar approves and locks them", async ({ page }) => {
  await signInAs(page, "registrar");
  await open(page, "/grades");
  await page.getByRole("link", { name: /Review Grade 11 A · Mathematics, Period 1/ }).click();
  await page.waitForLoadState("networkidle");
  await confirm(page, "Approve Period 1", "Approve");
  await expect(page.getByText("Period 1 scores are approved")).toBeVisible();
  await confirm(page, "Lock Period 1", "Lock scores");
  await expect(page.getByText("Period 1 scores are locked")).toBeVisible();
});

test("the Registrar prints the new student's report card", async ({ page }) => {
  await signInAs(page, "registrar");
  await open(page, studentPath);
  const href = await page.getByRole("link", { name: "Report card PDF" }).getAttribute("href");
  const response = await page.request.get(href ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("the parent sees the published score and downloads the report card", async ({ page }) => {
  await signInAs(page, "parent");
  await open(page, "/grades");
  const current = page.getByRole("region", { name: /Semester 2/ }).first();
  await expect(current.getByRole("row", { name: /Mathematics/ })).toContainText("88.00");
  const href = await current.getByRole("link", { name: /Report card/ }).getAttribute("href");
  const pdf = await page.request.get(href ?? "");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});
