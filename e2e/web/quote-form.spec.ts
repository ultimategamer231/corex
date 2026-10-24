import { expect, test, type Page } from "@playwright/test";

async function fillValidQuote(page: Page) {
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByLabel("Organization").fill("Test Academy");
  await page.getByLabel("Country").fill("Liberia");
  await page.getByLabel("What do you need?").selectOption("clinic");
  await page.getByLabel("Phone or WhatsApp").fill("+231 770 000 000");
  await page
    .getByLabel("Tell us about your needs")
    .fill("We have two branches and use paper records today.");
  await page.getByRole("checkbox").check();
}

// Each test sends from its own address so the per-IP limit (5 an hour) never interferes.
test.describe("quote form", () => {
  test("shows inline errors next to each field", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();
    await expect(page.getByText("Choose what you need")).toBeVisible();
    await expect(page.getByText("Please agree so we can contact you")).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Your name")).toHaveAttribute("aria-describedby", /name-error/);
  });

  test("sends a valid request and offers another", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.10" });
    await page.goto("/contact?product=clinic");
    await expect(page.getByLabel("What do you need?")).toHaveValue("clinic");
    await fillValidQuote(page);
    await page.getByRole("button", { name: "Send request" }).click();
    const status = page.getByRole("status").filter({ hasText: "We received your request" });
    await expect(status).toBeVisible();
    await expect(status).toBeFocused();
    await page.getByRole("button", { name: "Send another request" }).click();
    await expect(page.getByLabel("Your name")).toHaveValue("");
  });

  test("limits requests per address", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.20" });
    await page.goto("/contact");
    for (let i = 0; i < 5; i++) {
      await fillValidQuote(page);
      await page.getByRole("button", { name: "Send request" }).click();
      await page.getByRole("button", { name: "Send another request" }).click();
    }
    await fillValidQuote(page);
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "several requests in the last hour" }),
    ).toBeVisible();
  });
});
