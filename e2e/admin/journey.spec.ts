// The whole Corex Admin journey (SPEC-ADMIN.md 14, A6): a website request becomes a
// client, its first milestone is invoiced with a discount, the PDF downloads, a part
// payment gets its receipt, the daily check drafts the renewal, and the activity log
// still verifies. Uses its own lead, so other admin specs do not affect it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { setWidth } from "../helpers";
import { open, OWNER_STATE, SCHEMA } from "./helpers";

test.use({ storageState: OWNER_STATE });
test.setTimeout(180_000);

const CRON_SECRET = "e2e-only-cron-secret-not-for-real-use-000";
// Finance, so the leads spec's Clinic filter and export still see only their own lead.
const ORG = "Unity Traders Cooperative";

/** The built admin's local settings (scripts/school-env.mjs), for the website's insert. */
function localSupabase(): { url: string; serviceKey: string } {
  const env = Object.fromEntries(
    readFileSync("apps/admin/.env.production.local", "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}

/** A quote request saved exactly as the website saves one (apps/web/lib/leads/store.ts). */
async function websiteRequest(page: Page) {
  const { url, serviceKey } = localSupabase();
  const response = await page.request.post(`${url}/rest/v1/leads`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Profile": SCHEMA,
      Prefer: "return=minimal",
    },
    data: {
      name: "Comfort Wesseh",
      organization: ORG,
      country: "Liberia",
      product: "finance",
      plan_interest: "managed",
      phone: "+231 77 555 0909",
      email: "accounts@unity-traders.example",
      message: "Forty members and a shop. We want our accounts and payments in one place.",
      consent: true,
      source_page: "/software/finance",
    },
  });
  expect(response.status()).toBe(201);
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

test("website lead to client, discounted milestone invoice, PDF, part payment, receipt, renewal and a verified log", async ({
  page,
}) => {
  await setWidth(page, 1440);
  await websiteRequest(page);

  // The request arrives as a new lead, with its original message.
  await open(page, `/leads?q=${encodeURIComponent(ORG)}`);
  await page
    .getByRole("link", { name: new RegExp(ORG) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(ORG);
  await expect(page.getByText("Comfort Wesseh").first()).toBeVisible();
  await expect(page.getByText("Forty members and a shop.")).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Convert it: a Managed client signed for US$2,000 with a US$500 yearly renewal.
  await page.getByRole("link", { name: "Convert to client" }).click();
  const form = page.getByRole("form", { name: "Convert to client" });
  await expect(form.getByLabel("Name").first()).toHaveValue(ORG);
  await page.waitForLoadState("networkidle");
  await form.getByLabel("City").fill("Gbarnga");
  await form.getByLabel("Contract amount").fill("2,000");
  await form.getByLabel(/Yearly renewal/).fill("500");
  await form.getByLabel("Signing date").fill(daysAgo(380));
  await form.getByRole("button", { name: "Convert to client" }).click();
  await expect(page.getByRole("heading", { level: 1, name: ORG })).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");

  // It went live 340 days ago, so its first renewal is 25 days away.
  await page.getByRole("button", { name: "Edit deployment" }).click();
  const deployment = page.getByRole("dialog");
  await deployment.getByLabel("State").selectOption("live");
  await deployment.getByLabel("Went live on").fill(daysAgo(340));
  await deployment.getByRole("button", { name: "Save" }).click();
  await expect(deployment).toBeHidden();

  // Milestone 1 (50% = US$1,000) with a 10% discount.
  await page.getByRole("link", { name: "Create invoice for milestone 1" }).click();
  const draft = page.getByRole("form", { name: "Invoice draft" });
  await expect(draft.getByLabel("Unit price (USD)")).toHaveValue("1000.00");
  await page.waitForLoadState("networkidle");
  await draft.getByLabel("Type").selectOption("percent");
  await draft.getByLabel("Percent").fill("10");
  await draft.getByLabel(/Reason \(internal/).fill("Signed within a week");
  await expect(page.getByRole("region", { name: "Totals" })).toContainText("US$900.00");
  await draft.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Draft invoice" })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Send invoice" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Send invoice" }).click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/^CX-\d{2}-\d{2}-\d{3}$/);
  const number = (await heading.textContent()) ?? "";

  // The PDF downloads.
  const pdfHref = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  const pdf = await page.request.get(pdfHref ?? "");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain(`${number}.pdf`);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // A part payment of US$500 gets a receipt; US$400 stays owed.
  await page.getByRole("button", { name: "Record payment" }).click();
  const payment = page.getByRole("dialog");
  await payment.getByLabel("Amount (USD)").fill("500");
  await payment.getByLabel("Method").selectOption("orange_money");
  await payment.getByLabel("Reference").fill("OM-77001");
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(payment).toBeHidden();
  await expect(page.getByText("Partly paid").first()).toBeVisible();
  const payments = page.getByRole("list", { name: "Payments" });
  await expect(payments).toContainText(/RC-\d{2}-\d{2}-\d{3}/);
  const receiptHref = await payments
    .getByRole("link", { name: /Download receipt/ })
    .first()
    .getAttribute("href");
  const receipt = await page.request.get(receiptHref ?? "");
  expect(receipt.headers()["content-type"]).toBe("application/pdf");

  // The daily check drafts the renewal invoice for the coming renewal.
  const run = await page.request.post("/api/cron/daily", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(run.status()).toBe(200);
  await open(page, "/subscriptions");
  const row = page
    .getByRole("region", { name: "Managed plan renewals" })
    .getByRole("row", { name: new RegExp(ORG) });
  await expect(row).toContainText("Due soon");
  await expect(row.getByRole("link", { name: /Draft/ })).toBeVisible();

  // The dashboard and the activity log show what happened.
  await open(page, "/");
  await expect(
    page.getByRole("region", { name: "Needs attention" }).getByRole("link", {
      name: new RegExp(`${ORG} renews in \\d+ days`),
    }),
  ).toBeVisible();
  await open(page, `/activity?q=${encodeURIComponent(ORG)}`);
  await expect(page.getByRole("main")).not.toContainText("No entries");
  await expect(page.getByRole("main")).toContainText(ORG);

  // The activity log's hash chain still verifies.
  const verified = execFileSync(
    "node",
    ["packages/db/src/cli/admin-verify-log.ts", "--schema", SCHEMA],
    { encoding: "utf8" },
  );
  expect(verified).toMatch(/activity log intact/);
});
