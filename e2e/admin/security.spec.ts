// Hardening checks for Corex Admin (SPEC-ADMIN.md 2, 12): security headers on every kind
// of response, nothing reachable signed out except sign-in and the client view link,
// and limits on guessing the daily check's secret.
import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./helpers";

const NOT_A_RECORD = "00000000-0000-4000-8000-000000000000";

function expectSecurityHeaders(headers: Record<string, string>) {
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(headers["strict-transport-security"]).toMatch(/max-age=\d+/);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBeTruthy();
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
}

test("every kind of response carries the security headers and noindex", async ({ request }) => {
  for (const path of ["/login", "/i/not-a-real-link", "/api/cron/daily", "/robots.txt"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expectSecurityHeaders(response.headers());
  }
});

test("signed out, every admin page and download leads to sign-in", async ({ request }) => {
  const pages = [
    "/",
    "/leads",
    `/leads/${NOT_A_RECORD}`,
    "/clients",
    `/clients/${NOT_A_RECORD}`,
    "/subscriptions",
    "/invoices",
    "/invoices/new",
    `/invoices/${NOT_A_RECORD}`,
    "/activity",
    "/settings/team",
    "/settings/prices",
    "/settings/renewals",
  ];
  for (const path of pages) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toMatch(/\/login/);
  }
  const downloads = [
    "/leads/export",
    "/activity/export",
    `/invoices/${NOT_A_RECORD}/pdf`,
    `/invoices/receipts/${NOT_A_RECORD}/pdf`,
    `/leads/${NOT_A_RECORD}/quote`,
    `/clients/${NOT_A_RECORD}/documents/${NOT_A_RECORD}`,
  ];
  for (const path of downloads) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).not.toBe(200);
    expect(response.headers()["content-type"] ?? "", path).not.toContain("application/pdf");
    expect(response.headers()["content-type"] ?? "", path).not.toContain("text/csv");
  }
});

test("guessing the daily check's secret is stopped after 10 tries an hour", async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    const response = await request.post("/api/cron/daily", {
      headers: { Authorization: `Bearer guess-${i}-${"x".repeat(40)}` },
    });
    statuses.push(response.status());
  }
  expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
  expect(statuses.at(-1)).toBe(429);
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE });

  test("pages and downloads carry the security headers and are never cached", async ({ page }) => {
    const response = await page.goto("/");
    expectSecurityHeaders(response?.headers() ?? {});
    const csv = await page.request.get("/leads/export");
    expect(csv.status()).toBe(200);
    expectSecurityHeaders(csv.headers());
    expect(csv.headers()["cache-control"] ?? "").toMatch(/no-store|private/);
  });
});
