import { describe, expect, it } from "vitest";
import { allNavHrefs, navFor } from "./shell";

describe("app navigation", () => {
  it("has unique, absolute links with labels", () => {
    expect(new Set(allNavHrefs).size).toBe(allNavHrefs.length);
    for (const item of navFor(["super_admin", "registrar", "bursar", "student"], "college")) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.label.trim()).not.toBe("");
    }
  });

  it("shows each role only its own sections", () => {
    const labels = (roles: string[]) => navFor(roles, "college").map((i) => i.label);
    expect(labels(["student"])).toEqual([
      "Dashboard",
      "Course planning",
      "Grades",
      "Fees",
      "Reports",
      "Announcements",
    ]);
    expect(labels(["instructor"])).toEqual(["Dashboard", "Attendance", "Grades", "Announcements"]);
    expect(labels(["bursar"])).toEqual([
      "Dashboard",
      "Students",
      "Fees",
      "Reports",
      "Announcements",
    ]);
    expect(labels(["super_admin"])).toContain("Settings");
    expect(labels(["registrar"])).not.toContain("Settings");
    expect(labels(["registrar"])).not.toContain("Fees");
  });

  it("hides College-only sections in the High School edition", () => {
    const labels = navFor(["registrar", "student"], "highschool").map((i) => i.label);
    expect(labels).not.toContain("Course planning");
    expect(labels).not.toContain("Registration");
  });

  it("puts at most four items in the mobile bottom bar", () => {
    expect(navFor(["super_admin"], "college").filter((i) => i.primary)).toHaveLength(4);
  });
});
