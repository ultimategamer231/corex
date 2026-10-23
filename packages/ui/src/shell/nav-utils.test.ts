import { describe, expect, it } from "vitest";
import { bottomBarItems, initials, isNavItemActive } from "./nav-utils";

describe("isNavItemActive", () => {
  it("matches exact items only on the exact path", () => {
    expect(isNavItemActive({ href: "/", exact: true }, "/")).toBe(true);
    expect(isNavItemActive({ href: "/", exact: true }, "/students")).toBe(false);
  });

  it("matches prefix items on child paths but not on look-alike paths", () => {
    const item = { href: "/students" };
    expect(isNavItemActive(item, "/students")).toBe(true);
    expect(isNavItemActive(item, "/students/123")).toBe(true);
    expect(isNavItemActive(item, "/students-archive")).toBe(false);
  });
});

describe("bottomBarItems", () => {
  const item = (href: string, primary = false) => ({ href, label: href, icon: null, primary });

  it("prefers items marked primary, up to four", () => {
    const items = [item("/a"), item("/b", true), item("/c", true), item("/d")];
    expect(bottomBarItems(items).map((i) => i.href)).toEqual(["/b", "/c"]);
  });

  it("falls back to the first four items", () => {
    const items = ["/a", "/b", "/c", "/d", "/e"].map((h) => item(h));
    expect(bottomBarItems(items)).toHaveLength(4);
  });
});

describe("initials", () => {
  it("uses the first letters of the first two words", () => {
    expect(initials("Jartu Kollie")).toBe("JK");
    expect(initials("  sample  medical center ")).toBe("SM");
    expect(initials("")).toBe("?");
  });
});
