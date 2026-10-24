import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addToRegistry, readRegistry, schemasFor } from "./registry.ts";

function tempRegistry() {
  return join(mkdtempSync(join(tmpdir(), "corex-registry-")), "schemas.json");
}

describe("schema registry", () => {
  it("starts empty when the file does not exist", () => {
    expect(readRegistry(tempRegistry())).toEqual([]);
  });

  it("adds entries once, sorted, and filters by product and project", () => {
    const path = tempRegistry();
    addToRegistry(
      { schema: "demo_college", product: "school", project: "demo", org: "Sample College" },
      path,
    );
    addToRegistry(
      { schema: "client_bethel", product: "school", project: "main", org: "Bethel" },
      path,
    );
    addToRegistry(
      { schema: "demo_clinic", product: "clinic", project: "demo", org: "Sample Clinic" },
      path,
    );
    addToRegistry(
      { schema: "demo_college", product: "school", project: "demo", org: "Sample College" },
      path,
    );
    expect(readRegistry(path).map((e) => e.schema)).toEqual([
      "demo_clinic",
      "demo_college",
      "client_bethel",
    ]);
    expect(schemasFor("school", undefined, path)).toHaveLength(2);
    expect(schemasFor("school", "demo", path).map((e) => e.schema)).toEqual(["demo_college"]);
  });

  it("rejects invalid entries", () => {
    expect(() =>
      addToRegistry(
        { schema: "public", product: "school", project: "demo", org: "x" },
        tempRegistry(),
      ),
    ).toThrow();
  });
});
