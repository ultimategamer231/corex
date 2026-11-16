import { describe, expect, it } from "vitest";
import {
  analyticsConfig,
  parseStats,
  QUERY,
  queryVariables,
  rangeDates,
  rangeFrom,
} from "./website-analytics";

const now = new Date("2026-11-16T10:30:00Z");

describe("website analytics settings", () => {
  it("needs all three Cloudflare settings", () => {
    expect(analyticsConfig({})).toBeNull();
    expect(analyticsConfig({ CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a" })).toBeNull();
    expect(
      analyticsConfig({
        CLOUDFLARE_API_TOKEN: " t ",
        CLOUDFLARE_ACCOUNT_ID: "a",
        CLOUDFLARE_WEB_ANALYTICS_SITE_TAG: "s",
      }),
    ).toEqual({ apiToken: "t", accountId: "a", siteTag: "s" });
  });

  it("offers 7 and 30 days, 7 by default", () => {
    expect(rangeFrom(undefined)).toBe(7);
    expect(rangeFrom("30")).toBe(30);
    expect(rangeFrom("365")).toBe(7);
  });
});

describe("the Cloudflare request", () => {
  it("covers whole days up to now, for this site, without bots", () => {
    expect(rangeDates(7, now)).toEqual({ start: "2026-11-10", end: "2026-11-16" });
    expect(queryVariables({ apiToken: "t", accountId: "acc", siteTag: "site" }, 7, now)).toEqual({
      accountTag: "acc",
      siteTag: "site",
      start: "2026-11-10T00:00:00Z",
      end: "2026-11-16T10:30:00.000Z",
    });
    expect(QUERY).toContain("{ bot: 0 }");
    expect(QUERY).toContain("{ siteTag: $siteTag }");
  });
});

describe("parseStats", () => {
  const answer = {
    data: {
      viewer: {
        accounts: [
          {
            totals: [{ count: 30, sum: { visits: 12 } }],
            days: [
              { count: 10, sum: { visits: 4 }, dimensions: { value: "2026-11-11" } },
              { count: 20, sum: { visits: 8 }, dimensions: { value: "2026-11-16" } },
            ],
            pages: [{ count: 18, sum: { visits: 9 }, dimensions: { value: "/" } }],
            referrers: [
              { count: 5, sum: { visits: 3 }, dimensions: { value: "" } },
              { count: 4, sum: { visits: 2 }, dimensions: { value: "www.google.com" } },
            ],
            countries: [{ count: 30, sum: { visits: 12 }, dimensions: { value: "Liberia" } }],
            devices: [{ count: 25, sum: { visits: 10 }, dimensions: { value: "mobile" } }],
          },
        ],
      },
    },
    errors: null,
  };

  it("fills every day of the range and names the rows plainly", () => {
    const stats = parseStats(answer, 7, now);
    expect(stats.visits).toBe(12);
    expect(stats.views).toBe(30);
    expect(stats.days).toHaveLength(7);
    expect(stats.days[0]).toEqual({ date: "2026-11-10", visits: 0, views: 0 });
    expect(stats.days[1]).toEqual({ date: "2026-11-11", visits: 4, views: 10 });
    expect(stats.days[6]).toEqual({ date: "2026-11-16", visits: 8, views: 20 });
    expect(stats.referrers.map((r) => r.label)).toEqual(["Direct or unknown", "www.google.com"]);
    expect(stats.devices[0]?.label).toBe("Phone");
  });

  it("passes Cloudflare's error message on", () => {
    expect(() =>
      parseStats({ data: null, errors: [{ message: "not authorized" }] }, 7, now),
    ).toThrow("not authorized");
  });
});
