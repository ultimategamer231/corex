import { describe, expect, it } from "vitest";
import {
  activityCsv,
  changeLines,
  filtersQuery,
  likePattern,
  parseFilters,
  type ActivityRow,
} from "./activity";
import { securityFrom } from "./settings";

const row: ActivityRow = {
  seq: 7,
  created_at: "2026-10-29T10:42:00Z",
  actor_type: "admin",
  actor_id: "u1",
  action: "update",
  area: "settings",
  summary: "Changed settings",
  table_name: "settings",
  record_id: "true",
  before: { config: { a: 1 }, org_name: "Corex", updated_at: "x" },
  after: { config: { a: 2 }, org_name: "Corex", updated_at: "y" },
  reason: null,
  ip: "41.57.1.2",
  user_agent: "Chrome",
};

describe("activity log (LOG-04)", () => {
  it("lists only the fields that changed", () => {
    expect(changeLines(row)).toEqual(['config: {"a":1} → {"a":2}']);
    expect(
      changeLines({ ...row, before: null, after: { name: "Maima", status: "invited" } }),
    ).toEqual(["name: Maima", "status: invited"]);
  });

  it("keeps unknown filters out and the rest in links", () => {
    const filters = parseFilters({
      area: "leads",
      admin: "not-a-uuid",
      from: "2026-10-01",
      page: "2",
      q: " x ",
    });
    expect(filters).toEqual({ area: "leads", from: "2026-10-01", page: 2, q: "x" });
    expect(filtersQuery(filters, { page: undefined })).toBe("?q=x&area=leads&from=2026-10-01");
  });

  it("searches % and _ as plain characters", () => {
    expect(likePattern("50%_off")).toBe("%50\\%\\_off%");
  });

  it("exports CSV with quoting and no spreadsheet formulas", () => {
    const csv = activityCsv(
      [{ ...row, summary: '=HYPERLINK("x"), "quoted"' }],
      new Map([["u1", "Fatu Admin"]]),
    );
    const [header, line] = csv.split("\r\n");
    expect(header).toMatch(/^Entry,When \(GMT\),Admin,Area/);
    expect(line).toContain("Fatu Admin,Settings,update,");
    expect(line).toContain(`"'=HYPERLINK(""x""), ""quoted"""`);
  });
});

describe("security settings", () => {
  it("defaults to 4 hours and 30-day trusted devices", () => {
    expect(securityFrom({})).toEqual({ timeoutMinutes: 240, trustedDeviceDays: 30 });
    expect(securityFrom({ session_timeout_minutes: 60, trusted_device_days: 7 })).toEqual({
      timeoutMinutes: 60,
      trustedDeviceDays: 7,
    });
    expect(securityFrom({ trusted_device_days: 365 }).trustedDeviceDays).toBe(30);
  });
});
