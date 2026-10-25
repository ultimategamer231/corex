import { describe, expect, it } from "vitest";
import { navFor } from "./shell";

describe("clinic navigation", () => {
  it("has unique links and at most four bottom-bar items for every role", () => {
    for (const role of ["admin", "clinician", "nurse", "receptionist", "cashier"]) {
      const nav = navFor([role]);
      const hrefs = nav.map((i) => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(nav.filter((i) => i.primary).length).toBeLessThanOrEqual(4);
    }
  });

  it("shows billing only to the Cashier and settings only to the Admin (SPEC.md 8.1)", () => {
    expect(navFor(["cashier"]).map((i) => i.href)).toContain("/billing");
    expect(navFor(["clinician"]).map((i) => i.href)).not.toContain("/billing");
    expect(navFor(["admin"]).map((i) => i.href)).toContain("/settings");
    expect(navFor(["receptionist"]).map((i) => i.href)).not.toContain("/settings");
  });
});
