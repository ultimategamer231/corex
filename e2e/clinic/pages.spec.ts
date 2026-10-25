// Clinic screens: accessibility, layout and touch targets at every width.
import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  expectNoSeriousA11yViolations,
  expectTouchTargets,
  saveScreenshot,
  setWidth,
  widths,
} from "../helpers";
import { open, type Role, signInAs } from "./helpers";

const screens: { role: Role; path: string; heading: string | RegExp }[] = [
  { role: "admin", path: "/", heading: "Today" },
  { role: "admin", path: "/reports", heading: "Reports" },
  { role: "admin", path: "/reports?report=services", heading: "Reports" },
  { role: "admin", path: "/settings", heading: "Settings" },
  { role: "receptionist", path: "/", heading: "Today" },
  { role: "receptionist", path: "/patients", heading: "Patients" },
  { role: "receptionist", path: "/patients/new", heading: "Register patient" },
  { role: "receptionist", path: "/appointments", heading: "Appointments" },
  { role: "receptionist", path: "/appointments/new?q=Kamara", heading: "Book appointment" },
  { role: "receptionist", path: "/queue", heading: "Queue" },
  { role: "cashier", path: "/billing", heading: "Billing" },
  { role: "cashier", path: "/billing/new", heading: "New bill" },
];

for (const screen of screens) {
  test(`${screen.role} ${screen.path} is accessible and fits`, async ({ page }, testInfo) => {
    await signInAs(page, screen.role);
    for (const width of widths) {
      await setWidth(page, width);
      await page.goto(screen.path);
      await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
      if (width === 390 || width === 1440) {
        const name = screen.path.replace(/[/?=&]+/g, "-").replace(/-$/, "") || "-home";
        await saveScreenshot(page, testInfo, `clinic-${screen.role}${name}-${width}`);
      }
    }
  });
}

test("a clinician's view of a patient record is accessible and fits", async ({
  page,
}, testInfo) => {
  await signInAs(page, "clinician");
  await open(page, "/patients?q=Kamara");
  await page.getByRole("link", { name: "Kebeh Kamara" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kebeh Kamara" })).toBeVisible();
  const path = new URL(page.url()).pathname;
  for (const width of widths) {
    await setWidth(page, width);
    await page.goto(path);
    await expect(page.getByRole("note")).toContainText("Allergies: Penicillin");
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    if (width === 390 || width === 1440) {
      await saveScreenshot(page, testInfo, `clinic-clinician-patient-${width}`);
    }
  }
});

test("roles without access get 404 for other sections", async ({ page }) => {
  await signInAs(page, "cashier");
  for (const path of ["/queue", "/settings", "/patients/new"]) {
    expect((await page.goto(path))?.status()).toBe(404);
  }
  await page.context().clearCookies();
  await signInAs(page, "receptionist");
  for (const path of ["/billing", "/reports", "/settings"]) {
    expect((await page.goto(path))?.status()).toBe(404);
  }
});
