import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./dates";
import { isDemoMode, publicEnv } from "./env";
import { configNumber, parseSettings } from "./settings";

const row = {
  org_name: "Bethel High School",
  logo_path: null,
  address: "Carey Street, Monrovia",
  phone: "+231 770 000 000",
  email: null,
  letterhead_text: "Excellence in learning",
  base_currency: "USD",
  enabled_currencies: ["USD", "LRD"],
  timezone: "Africa/Monrovia",
  config: { max_credits_per_term: 18 },
};

describe("settings (CORE-01)", () => {
  it("maps the settings row", () => {
    expect(parseSettings(row)).toMatchObject({
      orgName: "Bethel High School",
      baseCurrency: "USD",
    });
  });

  it("reads product config with defaults", () => {
    const settings = parseSettings(row);
    expect(configNumber(settings, "max_credits_per_term", 21)).toBe(18);
    expect(configNumber(settings, "min_credits_per_term", 12)).toBe(12);
  });

  it("rejects unknown currencies", () => {
    expect(() => parseSettings({ ...row, base_currency: "EUR" })).toThrow();
  });
});

describe("publicEnv (SPEC.md 4.2)", () => {
  it("requires every variable and a safe schema name", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://xyz.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      NEXT_PUBLIC_DB_SCHEMA: "client_bethel_school",
      NEXT_PUBLIC_STORAGE_BUCKET: "client_bethel_school",
    };
    expect(publicEnv(env).schema).toBe("client_bethel_school");
    expect(() => publicEnv({ ...env, NEXT_PUBLIC_DB_SCHEMA: "public; drop" })).toThrow(
      /not configured/,
    );
    expect(isDemoMode({ DEMO_MODE: "true" })).toBe(true);
    expect(isDemoMode({})).toBe(false);
  });
});

describe("dates (Africa/Monrovia, UTC+0)", () => {
  it("formats in the organization's timezone", () => {
    expect(formatDateTime("2026-10-24T01:30:00Z")).toBe("24 Oct 2026, 01:30");
    expect(formatDate("2026-10-24T23:30:00Z", "Africa/Lagos")).toBe("25 Oct 2026");
  });
});
