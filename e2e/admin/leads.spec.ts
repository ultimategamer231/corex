// Leads in Corex Admin (SPEC-ADMIN.md 8.1): LEAD-01 to LEAD-05 and LEAD-07 in the browser,
// on the fixture's leads (packages/db/src/fixtures/admin.ts). Tests change those leads,
// so they run in order and each works on its own lead.
import { readFile } from "node:fs/promises";
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

async function openLead(page: Page, search: string, organization: string) {
  await open(page, `/leads?q=${encodeURIComponent(search)}`);
  await page
    .getByRole("link", { name: new RegExp(organization) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: organization })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("website requests are listed, filtered and exported with the filters (LEAD-01, LEAD-07)", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await open(page, "/leads");
  const table = page.getByRole("region", { name: "Leads" });
  await expect(table.getByRole("link", { name: /Greenfield Academy/ })).toBeVisible();
  await expect(table.getByRole("link", { name: /Saint Luke's Clinic/ })).toBeVisible();

  await page.getByLabel("Product").selectOption("clinic");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/product=clinic/);
  await expect(table.getByRole("link", { name: /Saint Luke's Clinic/ })).toBeVisible();
  await expect(table.getByRole("link", { name: /Greenfield Academy/ })).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const csv = await readFile((await (await download).path()) ?? "", "utf8");
  expect(csv).toContain("Saint Luke's Clinic");
  expect(csv).not.toContain("Greenfield Academy");

  await open(page, "/activity?area=leads");
  await expect(page.getByText("Exported 1 lead to CSV")).toBeVisible();
  // Searched for, since other specs add entries that can push it to a later page.
  await open(page, "/activity?area=leads&q=Greenfield");
  await expect(page.getByText("Website quote request from Greenfield Academy")).toBeVisible();

  await openLead(page, "St. Peter", "St. Peter's College");
  await expect(page.getByText("Read-only")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit details" })).toHaveCount(0);
  await expect(page.getByText("Quote request submitted on the website")).toBeVisible();
});

test("a lead added by hand needs a phone or email, and a likely duplicate is flagged (LEAD-02, LEAD-03)", async ({
  page,
}) => {
  await open(page, "/leads/new");
  await page.getByLabel("Contact name").fill("Patrick Mulbah");
  await page.getByLabel("Organization").fill("Kakata Community School");
  await page.getByRole("button", { name: "Add lead" }).click();
  await expect(page.getByText("Enter a phone number or an email address")).toBeVisible();

  // The same number as Greenfield Academy's website request, written differently.
  await page.getByLabel("Phone or WhatsApp").fill("0775550101");
  await page.getByLabel("Country").fill("Liberia");
  await page.getByRole("button", { name: "Add lead" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Kakata Community School" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("This may be a duplicate")).toBeVisible();
  await expect(page.getByRole("link", { name: /Greenfield Academy/ })).toBeVisible();

  await page.getByRole("button", { name: "Edit details" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("pmulbah@kakata.example");
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("pmulbah@kakata.example")).toBeVisible();
});

test("stage changes need a reason for Lost and every entry stays on the timeline (LEAD-04, LEAD-05)", async ({
  page,
}) => {
  await openLead(page, "Mano River", "Mano River Logistics");
  const status = page.getByRole("form", { name: "Lead status" });
  await status.getByLabel("Stage").selectOption("lost");
  await status.getByRole("button", { name: "Save status" }).click();
  await expect(status.getByText("Say why this lead was lost")).toBeVisible();
  await status.getByLabel("Why was it lost?").fill("No budget this year");
  await status.getByRole("button", { name: "Save status" }).click();
  await expect(status.getByText("Saved.")).toBeVisible();
  const timeline = page.getByRole("list", { name: "Timeline" });
  await expect(
    timeline.getByText("Stage changed from New to Lost. Reason: No budget this year."),
  ).toBeVisible();

  const note = page.getByRole("form", { name: "Add to timeline" });
  await note.getByLabel("Activity type").selectOption("call");
  await note.getByLabel("What happened").fill("Called back; asked us to try again in January.");
  await note.getByRole("button", { name: "Add to timeline" }).click();
  await expect(timeline.getByText("Called back; asked us to try again in January.")).toBeVisible();
  await expect(page.getByRole("button", { name: /edit|delete|remove/i })).toHaveCount(0);

  await status.getByLabel("Stage").selectOption("contacted");
  await status.getByLabel("Assigned to").selectOption({ label: "Maima Gbessay" });
  await status.getByLabel("Next follow-up").fill("2026-12-01");
  await status.getByRole("button", { name: "Save status" }).click();
  await expect(timeline.getByText("Stage changed from Lost to Contacted.")).toBeVisible();
});

test("a quote lists its items, gets a number and a PDF, and fills the WhatsApp messages", async ({
  page,
}) => {
  await openLead(page, "Saint Luke", "Saint Luke's Clinic");
  const quote = page.getByRole("form", { name: "Quote" });
  await quote.getByLabel("Item 1").fill("Clinic Management");
  await quote.getByLabel("Price 1").fill("0");
  await quote.getByRole("button", { name: "Save quote" }).click();
  await expect(quote.getByText("Add at least one item with an amount above zero")).toBeVisible();
  await quote.getByLabel("Currency").selectOption("LRD");
  await quote.getByLabel("Price 1").fill("150,000");
  await quote.getByLabel("Item 2").fill("Staff training day");
  await quote.getByLabel("Qty 2").fill("2");
  await quote.getByLabel("Price 2").fill("5,000");
  await quote.getByLabel("What it covers").fill("Clinic Management, Managed plan");
  await quote.getByRole("button", { name: "Save quote" }).click();
  await expect(
    page
      .getByRole("list", { name: "Timeline" })
      .getByText("Quote prepared: L$160,000.00. Clinic Management, Managed plan."),
  ).toBeVisible();
  await expect(page.getByText(/^Quote QT-\d{2}-\d{2}-\d{3}$/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Quote items" })).toContainText(
    "2 × Staff training day",
  );

  const href = await page.getByRole("link", { name: "Download quote PDF" }).getAttribute("href");
  const pdf = await page.request.get(href ?? "");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain("QT-");

  const messages = page.getByRole("list", { name: "Ready messages" });
  await messages.getByText("Send the quote").click();
  await expect(messages).toContainText("L$160,000.00, valid until");
  await expect(messages).toContainText("70% when you approve the mock-up and design");
  const open = messages.getByRole("link", { name: "Open in WhatsApp: Send the demo" });
  expect(await open.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\d+\?text=Hello%20/);
});

test("the board moves a lead to another stage", async ({ page }) => {
  await setWidth(page, 1440);
  await open(page, "/leads?view=board");
  const board = page.getByRole("region", { name: "Leads board" });
  const contacted = board.getByRole("region", { name: /^Contacted/ });
  await expect(contacted.getByRole("link", { name: /Greenfield Academy/ })).toHaveCount(0);
  await board.getByRole("button", { name: /Move to.*Greenfield Academy/ }).click();
  await page.getByRole("menuitem", { name: "Contacted" }).click();
  await expect(page.getByText("Greenfield Academy moved to Contacted.")).toBeVisible();
  await expect(contacted.getByRole("link", { name: /Greenfield Academy/ })).toBeVisible();
});

test("phones get cards that open the lead", async ({ page }) => {
  await setWidth(page, 390);
  await open(page, "/leads?q=Unity");
  await page
    .getByRole("list", { name: "Leads" })
    .getByRole("link", { name: /Unity Pharmacy/ })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Unity Pharmacy" })).toBeVisible();
  await expect(page.getByText("This lead was lost")).toBeVisible();
});

test("leads pages pass at every width", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "/leads?q=St.%20Peter");
  const href = await page
    .getByRole("link", { name: /St\. Peter's College/ })
    .first()
    .getAttribute("href");
  for (const path of ["/leads", "/leads?view=board", "/leads/new", href ?? "/leads"]) {
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
