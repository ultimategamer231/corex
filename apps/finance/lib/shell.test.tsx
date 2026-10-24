import { describe, expect, it } from "vitest";
import { navFor } from "./shell";

describe("finance navigation", () => {
  it("has unique, absolute links with labels for every role", () => {
    for (const role of ["owner", "accountant", "staff"]) {
      const nav = navFor([role]);
      const hrefs = nav.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const item of nav) expect(item.href.startsWith("/")).toBe(true);
      expect(nav.filter((item) => item.primary).length).toBeLessThanOrEqual(4);
    }
  });

  it("keeps payroll, reports and settings from Staff (SPEC.md 9.1)", () => {
    const staff = navFor(["staff"]).map((i) => i.href);
    expect(staff).toEqual(["/", "/transactions", "/counterparties"]);
    expect(navFor(["accountant"]).map((i) => i.href)).toContain("/payroll");
  });
});
