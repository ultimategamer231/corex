import { describe, expect, it } from "vitest";
import { nav, sections } from "./shell";

describe("app navigation", () => {
  it("has unique, absolute links with labels", () => {
    const hrefs = nav.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const item of nav) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.label.trim()).not.toBe("");
    }
  });

  it("puts at most four items in the mobile bottom bar", () => {
    expect(nav.filter((item) => item.primary).length).toBeLessThanOrEqual(4);
  });

  it("lists every non-dashboard section for the placeholder pages", () => {
    expect(sections).toHaveLength(nav.length - 1);
    expect(sections).not.toContain("");
  });
});
