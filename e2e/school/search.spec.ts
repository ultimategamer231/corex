// The top bar search (Ctrl K) and the card list that replaces the table on phones.
import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, setWidth } from "../helpers";
import { open, signInAs } from "./helpers";

test("search finds records and pages from the keyboard", async ({ page }) => {
  await signInAs(page, "registrar");
  await setWidth(page, 1440);
  await open(page, "/");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(dialog).toBeVisible();
  const box = dialog.getByRole("combobox", { name: "Search" });
  await box.fill("Kpadeh");
  const results = dialog.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("group", { name: "Students" })).toContainText("Ama Kpadeh");
  await expectNoSeriousA11yViolations(page);
  await box.fill("stud");
  await expect(results.getByRole("group", { name: "Pages" })).toContainText("Students");
  await box.fill("zzzz-nothing");
  await expect(dialog.getByRole("status")).toHaveText('Nothing found for "zzzz-nothing".');
  await box.fill("Kpadeh");
  await expect(results.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Ama Kpadeh" })).toBeVisible();
});

test("phones show the list as cards, wider screens as a table", async ({ page }) => {
  await signInAs(page, "registrar");
  await setWidth(page, 390);
  await open(page, "/students");
  await expect(page.getByRole("list", { name: "Students" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Students" })).toBeHidden();
  await setWidth(page, 1024);
  await expect(page.getByRole("list", { name: "Students" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Students" })).toBeVisible();
});
