// Dashboard, subscriptions, the daily check, search, notifications and settings in Corex
// Admin (SPEC-ADMIN.md 7, 10, 11). On the fixture (packages/db/src/fixtures/admin.ts);
// other admin specs change invoices at the same time, so checks here use records they
// leave alone (Lakeside's warranty, Riverside's renewal, the price list).
import { expect, test } from "@playwright/test";
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

const CRON_SECRET = "e2e-only-cron-secret-not-for-real-use-000";

test("the dashboard shows the figures, what needs attention, pipeline, collections and renewals (SPEC-ADMIN.md 7)", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await open(page, "/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const figures = page.getByRole("region", { name: "Figures" });
  for (const label of [
    "New leads, last 7 days",
    "Open pipeline",
    "Outstanding",
    /Collected in \d{4}/,
  ]) {
    await expect(figures.getByText(label)).toBeVisible();
  }
  await expect(figures.getByRole("link", { name: /Outstanding US\$/ })).toBeVisible();

  const attention = page.getByRole("region", { name: "Needs attention" });
  await expect(
    attention.getByRole("link", { name: /Lakeside Institute warranty ends/ }),
  ).toHaveAttribute("href", /\/clients\//);
  await expect(
    attention.getByRole("link", { name: /Riverside Traders renews in \d+ days/ }),
  ).toBeVisible();

  const pipeline = page.getByRole("region", { name: "Lead pipeline" });
  for (const stage of ["New", "Contacted", "Demo booked", "Quoted", "Won", "Lost"]) {
    await expect(pipeline.getByText(stage, { exact: true })).toBeVisible();
  }
  await expect(pipeline.getByText(/Win rate this year/)).toBeVisible();
  await expect(
    page.getByRole("img", { name: /collected in \d{4}|No USD payments collected/ }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Renewals" })).toContainText("Riverside Traders");
  await expect(
    page.getByRole("region", { name: "Recent activity" }).getByRole("listitem"),
  ).toHaveCount(6);
});

test("subscriptions list renewals with their status, reminders and warranties (SPEC-ADMIN.md 10)", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await open(page, "/subscriptions");
  await expect(
    page.getByRole("heading", { level: 1, name: "Subscriptions and renewals" }),
  ).toBeVisible();
  const table = page.getByRole("region", { name: "Managed plan renewals" });
  const riverside = table.getByRole("row", { name: /Riverside Traders/ });
  await expect(riverside).toContainText("Due soon");
  await expect(riverside).toContainText(/In \d+ days/);
  await expect(riverside.getByRole("link", { name: /Draft/ })).toHaveAttribute(
    "href",
    /\/invoices\//,
  );
  await expect(riverside.getByRole("list", { name: /Reminders for Riverside/ })).toContainText(
    "14d",
  );
  await expect(table.getByRole("row", { name: /Bright Future NGO/ })).toContainText(/overdue/);
  const warranties = page.getByRole("region", { name: "Handover warranties" });
  await expect(warranties).toContainText("Lakeside Institute");
  await expect(warranties).toContainText(/\d+ days left/);
  await expect(page.getByRole("link", { name: "Change in Settings" })).toHaveAttribute(
    "href",
    "/settings/renewals",
  );
});

test("the daily check needs its secret and changes nothing when run twice (SPEC-ADMIN.md 10)", async ({
  request,
}) => {
  const denied = await request.post("/api/cron/daily");
  expect(denied.status()).toBe(401);
  const wrong = await request.post("/api/cron/daily", {
    headers: { Authorization: `Bearer ${"x".repeat(CRON_SECRET.length)}` },
  });
  expect(wrong.status()).toBe(401);
  const call = () =>
    request.post("/api/cron/daily", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  const first = await call();
  expect(first.status()).toBe(200);
  expect((await first.json()) as { ok: boolean }).toMatchObject({ ok: true });
  const second = await call();
  const body = (await second.json()) as { ok: boolean; summary: Record<string, unknown> };
  expect(body.ok).toBe(true);
  expect(body.summary).toMatchObject({ renewal_invoices: 0, reminders: 0 });
});

test("search finds clients, leads and invoices from the keyboard (SPEC-ADMIN.md 11)", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await open(page, "/");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(dialog).toBeVisible();
  const box = dialog.getByRole("combobox", { name: "Search" });
  await box.fill("Riverside");
  const results = dialog.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("group", { name: "Clients" })).toContainText("Riverside Traders");
  await expect(dialog.getByRole("status")).toHaveText(/\d+ results?\./);
  await box.fill("Greenfield");
  await expect(results.getByRole("group", { name: "Leads" })).toContainText("Musu Kollie");
  await box.fill("CX-");
  await expect(results.getByRole("group", { name: "Invoices" })).toBeVisible();
  await box.fill("Riverside");
  await expect(results.getByRole("option")).toHaveCount(1);
  await expect(results.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Riverside Traders" })).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Search" }).click();
  await dialog.getByRole("combobox", { name: "Search" }).fill("zzzz-nothing");
  await expect(dialog.getByRole("status")).toHaveText('Nothing found for "zzzz-nothing".');
});

test("the notifications bell lists what needs attention and clears the unread count (SPEC-ADMIN.md 11)", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await open(page, "/clients");
  const bell = page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
  await bell.click();
  // Opening the bell records that the items were seen (a server action).
  await page.waitForLoadState("networkidle");
  const sheet = page.getByRole("dialog", { name: "Needs attention" });
  await expect(sheet.getByRole("link", { name: /Lakeside Institute warranty ends/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();
  await open(page, "/leads");
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
});

test("settings: the price list prefills invoices; renewal rules and the daily check (SPEC-ADMIN.md 4, 10)", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await open(page, "/settings/prices");
  const list = page.getByRole("region", { name: "Price list" });
  await expect(list.getByRole("row", { name: /Clinic Management/ })).toContainText("US$2,500.00");

  await page.getByRole("button", { name: "Add item" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Item", exact: true }).fill("Extra report design");
  await dialog.getByRole("combobox", { name: "Kind" }).selectOption("addon");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog.getByText("Enter at least one price")).toBeVisible();
  await dialog.getByLabel("Managed: year 1").fill("75");
  await dialog.getByLabel("Unit").fill("per report");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog).toBeHidden();
  await expect(list.getByRole("row", { name: /Extra report design/ })).toContainText("US$75.00");

  await page.getByRole("button", { name: "Edit Extra report design" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Handover").fill("90");
  await dialog.getByRole("button", { name: "Save item" }).click();
  await expect(dialog).toBeHidden();
  await expect(list.getByRole("row", { name: /Extra report design/ })).toContainText("US$90.00");

  await open(page, "/invoices/new");
  const form = page.getByRole("form", { name: "Invoice draft" });
  await form.getByRole("combobox", { name: "Add from price list" }).selectOption({
    label: "Extra report design, Handover · US$90.00 per report",
  });
  await form.getByRole("button", { name: "Add item" }).click();
  await expect(form.getByLabel("Line 1 description")).toHaveValue("Extra report design");
  await expect(form.getByLabel("Unit price (USD)")).toHaveValue("90.00");

  await open(page, "/settings/prices");
  await page.getByRole("button", { name: "Remove Extra report design" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(list.getByRole("row", { name: /Extra report design/ })).toHaveCount(0);

  await open(page, "/settings/renewals");
  const rules = page.getByRole("form", { name: "Renewal settings" });
  const warranty = rules.getByLabel("Warn when a Handover warranty ends within 45 days");
  await expect(warranty).toBeChecked();
  await warranty.uncheck();
  await rules.getByRole("button", { name: "Save renewal settings" }).click();
  await expect(rules.getByText(/Renewal settings saved/)).toBeVisible();
  await open(page, "/");
  await expect(
    page.getByRole("region", { name: "Needs attention" }).getByText(/warranty ends/),
  ).toHaveCount(0);
  await open(page, "/settings/renewals");
  await rules.getByLabel("Warn when a Handover warranty ends within 45 days").check();
  await rules.getByRole("button", { name: "Save renewal settings" }).click();
  await expect(rules.getByText(/Renewal settings saved/)).toBeVisible();

  await page.getByRole("button", { name: "Run the daily check now" }).click();
  await expect(page.getByText(/Daily check done/)).toBeVisible({ timeout: 15_000 });
});

test("dashboard, subscriptions and the new settings pass at every width", async ({ page }) => {
  test.setTimeout(300_000);
  for (const path of ["/", "/subscriptions", "/settings/prices", "/settings/renewals"]) {
    for (const width of widths) {
      await setWidth(page, width);
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
    }
  }
  await setWidth(page, 390);
  await open(page, "/");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("combobox", { name: "Search" }).fill("Riverside");
  await expect(page.getByRole("option").first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
