// Offline mode (SPEC.md 10.3) in the Clinic: register a patient and record vitals with
// no connection, then sync once (OFF-01, OFF-02); a member suspended while offline
// cannot sync (OFF-03); signing out warns about waiting records and clears the device
// (OFF-04).
import { expect, type Page, test } from "@playwright/test";
import { outboxItems } from "../helpers";
import { confirm, open, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36);

async function registerOffline(page: Page, first: string, last: string) {
  const form = page.getByRole("form", { name: "Register patient" });
  await form.getByRole("textbox", { name: "First name" }).fill(first);
  await form.getByRole("textbox", { name: "Last name" }).fill(last);
  await form.getByRole("combobox", { name: "Sex" }).selectOption("female");
  await form.getByRole("combobox", { name: "Allergies" }).selectOption("no");
  await form.getByRole("button", { name: "Register patient" }).click();
  await expect(form.getByText(/is saved on this device/)).toBeVisible();
}

async function patientRows(page: Page, last: string) {
  await open(page, `/patients?q=${last}`);
  return page.getByRole("region", { name: "Patients" }).getByRole("row").count();
}

test("a patient registered offline syncs once on reconnect (OFF-01, OFF-02)", async ({
  page,
  context,
}) => {
  const last = `Offline${suffix}`;
  await signInAs(page, "receptionist");
  await open(page, "/patients/new");
  await context.setOffline(true);
  await expect(page.getByRole("status").first()).toContainText("Offline");
  await registerOffline(page, "Musu", last);
  const waiting = page.getByRole("region", { name: "Waiting to sync" });
  await expect(waiting).toContainText(`Musu ${last}`);
  await expect(waiting).toContainText("Pending sync");
  await expect(page.getByRole("status").first()).toContainText("1");
  const [saved] = await outboxItems(page, "clinic");
  expect(saved?.table).toBe("patients");

  await context.setOffline(false);
  await expect.poll(() => outboxItems(page, "clinic"), { timeout: 15_000 }).toHaveLength(0);
  await expect(waiting).toBeHidden();
  // Header row plus the one patient.
  expect(await patientRows(page, last)).toBe(2);

  // The same item sent again (a retry after a lost answer) is not stored twice.
  await page.evaluate(async (item) => {
    const dbs = await indexedDB.databases();
    const name = dbs.find((d) => d.name?.startsWith("corex-clinic-"))?.name ?? "";
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("outbox", "readwrite");
      tx.objectStore("outbox").put({ ...item, status: "pending", attempts: 0 });
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, saved);
  await page.reload();
  await expect.poll(() => outboxItems(page, "clinic"), { timeout: 15_000 }).toHaveLength(0);
  expect(await patientRows(page, last)).toBe(2);
});

test("vitals recorded offline at intake sync to the patient", async ({ page, context }) => {
  await signInAs(page, "nurse");
  await open(page, "/queue");
  // Add a walk-in as the nurse so the test has its own queue entry.
  await page.getByRole("searchbox", { name: "Find a patient" }).fill("Kamara");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: /^Choose Kebeh Kamara$/ }).click();
  await page.getByRole("button", { name: /to the queue$/ }).click();
  await expect(page.getByText(/Added to the queue|already in the queue/)).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Kebeh Kamara" })
    .getByRole("link", { name: "Take vitals" })
    .first()
    .click();
  await page.waitForLoadState("networkidle");

  await context.setOffline(true);
  const form = page.getByRole("form", { name: "Record vitals" });
  await form.getByRole("textbox", { name: "Temperature (°C)" }).fill("37.9");
  await form.getByRole("textbox", { name: "Pulse (per minute)" }).fill("88");
  await form.getByRole("button", { name: "Save vitals" }).click();
  await expect(form.getByText("Vitals saved on this device.")).toBeVisible();
  const waiting = page.getByRole("region", { name: "Vitals waiting to sync" });
  await expect(waiting).toContainText("37.9 °C");

  await context.setOffline(false);
  await expect.poll(() => outboxItems(page, "clinic"), { timeout: 15_000 }).toHaveLength(0);
  await expect(waiting).toBeHidden();
  await expect(page.getByRole("cell", { name: "37.9" })).toBeVisible();
});

async function newSignIn(admin: Page): Promise<{ email: string; password: string }> {
  const email = `offline-${suffix}@e2e-clinic.corex.test`;
  await open(admin, "/settings");
  const form = admin.getByRole("form", { name: "Add a user" });
  await form.getByRole("textbox", { name: "Name" }).fill(`Offline Tester ${suffix}`);
  await form.getByRole("textbox", { name: "Email" }).fill(email);
  await form.getByRole("combobox", { name: "Role" }).selectOption("receptionist");
  await form.getByRole("button", { name: "Create account" }).click();
  const message = await form.getByText(/Temporary password: /).textContent();
  const password = /Temporary password: (\S+) /.exec(message ?? "")?.[1] ?? "";
  expect(password).not.toBe("");
  return { email, password };
}

test("a member suspended while offline cannot sync, and signing out clears the device (OFF-03, OFF-04)", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signInAs(admin, "admin");
  const { email, password } = await newSignIn(admin);

  const context = await browser.newContext();
  const page = await context.newPage();
  await open(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await open(page, "/patients/new");
  await context.setOffline(true);
  await registerOffline(page, "Kumba", `Suspended${suffix}`);

  // The Admin suspends the account while the device is offline.
  await open(admin, "/settings");
  await confirm(admin, `Suspend Offline Tester ${suffix}`, "Suspend");
  await expect(
    admin.getByRole("button", { name: `Restore Offline Tester ${suffix}` }),
  ).toBeVisible();

  await context.setOffline(false);
  const waiting = page.getByRole("region", { name: "Waiting to sync" });
  await expect(waiting.getByText("Not synced")).toBeVisible({ timeout: 15_000 });
  await expect(waiting.getByRole("alert")).toContainText(
    "You do not have access to this organization",
  );
  expect(await outboxItems(page, "clinic")).toHaveLength(1);

  // Signing out warns about the waiting record; cancelling keeps it.
  const menu = page.getByRole("button", { name: /^Account menu for / });
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("1 record has not reached the server yet");
    void dialog.dismiss();
  });
  await menu.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await outboxItems(page, "clinic")).toHaveLength(1);

  page.once("dialog", (dialog) => void dialog.accept());
  await menu.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await outboxItems(page, "clinic")).toHaveLength(0);

  await context.close();
  await adminContext.close();
});

test("pages with clinical notes are never kept on the device (SPEC.md 10.1)", async ({ page }) => {
  await signInAs(page, "clinician");
  // Wait until the service worker controls the page, so later pages go through it.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });
  await open(page, "/patients?q=Kamara");
  await page.getByRole("link", { name: "Kebeh Kamara" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kebeh Kamara" })).toBeVisible();
  const patientPath = new URL(page.url()).pathname;
  await open(page, "/queue");
  await open(page, patientPath);

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain("/queue");
  // The empty registration form may be kept; patient records and visits may not.
  const clinical = cached.filter(
    (u) => /^\/patients\/[0-9a-f-]{36}/.test(u) || u.startsWith("/encounters/"),
  );
  expect(clinical).toEqual([]);
});
