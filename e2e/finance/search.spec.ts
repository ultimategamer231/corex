// The top bar search (Ctrl K). Phone cards for invoices are checked in flow.spec.ts.
import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, setWidth } from "../helpers";
import { open, signInAs } from "./helpers";

test("search finds records and pages from the keyboard", async ({ page }) => {
  await signInAs(page, "owner");
  await setWidth(page, 1440);
  await open(page, "/");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(dialog).toBeVisible();
  const box = dialog.getByRole("combobox", { name: "Search" });
  await box.fill("Kollie");
  const results = dialog.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("group", { name: "Customers and vendors" })).toContainText(
    "Kollie Supermarket",
  );
  await expectNoSeriousA11yViolations(page);
  await box.fill("payr");
  await expect(results.getByRole("group", { name: "Pages" })).toContainText("Payroll");
  await box.fill("zzzz-nothing");
  await expect(dialog.getByRole("status")).toHaveText('Nothing found for "zzzz-nothing".');
  await box.fill("Kollie");
  await expect(results.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: "Customers and vendors" }),
  ).toBeVisible();
});
