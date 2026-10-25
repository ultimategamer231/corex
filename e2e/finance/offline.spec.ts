// Offline mode (SPEC.md 10.3) in Finance: an expense with a receipt photo recorded with
// no connection reaches the server once on reconnect (OFF-01, OFF-02); offline photos
// are limited to 2 MB.
import { expect, test } from "@playwright/test";
import { outboxItems } from "../helpers";
import { open, signInAs } from "./helpers";

// A 1x1 PNG, as a receipt photo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("an expense with a receipt photo recorded offline syncs once (OFF-01)", async ({
  page,
  context,
}) => {
  const memo = `Offline taxi ${Date.now().toString(36)}`;
  await signInAs(page, "staff");
  await open(page, "/transactions/new?type=expense");
  await context.setOffline(true);
  const form = page.getByRole("form", { name: "Record an expense" });
  await form.getByRole("textbox", { name: "Amount" }).fill("15.75");
  await form
    .getByRole("combobox", { name: "Account", exact: true })
    .selectOption({ label: "Cash box (USD)" });
  await form
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Transport" });
  await form.getByRole("textbox", { name: "Note" }).fill(memo);

  // Offline, photos are kept on the device only up to 2 MB.
  await form.getByLabel("Receipt photo").setInputFiles({
    name: "big.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2_100_000, 1),
  });
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Offline, files can be up to 2 MB.")).toBeVisible();

  await form
    .getByLabel("Receipt photo")
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText(/Expense saved on this device/)).toBeVisible();
  const waiting = page.getByRole("region", { name: "Waiting to sync" });
  await expect(waiting).toContainText("Expense of 15.75");
  await expect(waiting).toContainText("with receipt photo");
  await expect(waiting).toContainText("Pending sync");

  await context.setOffline(false);
  await expect.poll(() => outboxItems(page, "finance"), { timeout: 15_000 }).toHaveLength(0);
  await expect(waiting).toBeHidden();

  await open(page, "/transactions?type=expense");
  const entry = page.getByRole("row", { name: new RegExp(memo) });
  await expect(entry).toHaveCount(1);
  await entry.getByRole("link").first().click();
  await expect(page.getByRole("link", { name: "Open the receipt" })).toBeVisible();
});
