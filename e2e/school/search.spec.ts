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

test.describe("loading feedback", () => {
  // The offline service worker answers page requests itself, so page.route could not
  // slow them down.
  test.use({ serviceWorkers: "block" });
  test("Search on the students page shows the loading bar", async ({ page }) => {
    await signInAs(page, "registrar");
    await setWidth(page, 390);
    await open(page, "/students");
    await page.route(/\/students\?q=/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    const find = page.getByRole("search", { name: "Find students" });
    await find.getByLabel("Name or student number").fill("Kpadeh");
    // Checked inside the page: while the next page loads, the test runner itself waits
    // for it and cannot look at the page being left.
    const shown = await find.evaluate(async (form) => {
      (form as HTMLFormElement).requestSubmit();
      await new Promise((r) => setTimeout(r, 300));
      return {
        bar: document.body.textContent?.includes("Loading page") ?? false,
        busy: document.getElementById("main")?.getAttribute("aria-busy") ?? null,
      };
    });
    expect(shown).toEqual({ bar: true, busy: "true" });
    await expect(page).toHaveURL(/q=Kpadeh/);
  });
});
