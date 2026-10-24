import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadMigrations, MigrationError, renderMigration } from "./migrations.ts";

const fixtures = join(import.meta.dirname, "..", "test", "fixtures");

describe("renderMigration", () => {
  it("replaces every schema placeholder", () => {
    expect(
      renderMigration("create table {{schema}}.a(); select * from {{schema}}.a;", "client_x"),
    ).toBe("create table client_x.a(); select * from client_x.a;");
  });

  it("rejects unknown placeholders", () => {
    expect(() => renderMigration("select {{shcema}}", "client_x")).toThrow(MigrationError);
  });

  it("rejects unsafe schema names before rendering", () => {
    expect(() => renderMigration("select 1", "x; drop schema public")).toThrow();
  });
});

describe("loadMigrations", () => {
  it("orders core before the product and records stable ids and checksums", () => {
    const migrations = loadMigrations("school", fixtures);
    expect(migrations.map((m) => m.id)).toEqual(["core/0001_items", "school/0001_school_items"]);
    expect(migrations[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never mixes another product's migrations", () => {
    const ids = loadMigrations("clinic", fixtures).map((m) => m.id);
    expect(ids).not.toContain("school/0001_school_items");
  });

  it("adds the demo layer last only when asked", () => {
    const plain = loadMigrations("school").map((m) => m.id);
    const demo = loadMigrations("school", undefined, { demo: true }).map((m) => m.id);
    expect(plain.some((id) => id.startsWith("demo/"))).toBe(false);
    expect(demo.filter((id) => id.startsWith("demo/")).at(0)).toBe("demo/0001_demo");
    expect(demo.at(-1)?.startsWith("demo/")).toBe(true);
    expect(demo.slice(0, plain.length)).toEqual(plain);
  });
});
