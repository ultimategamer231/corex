import { describe, expect, it } from "vitest";
import { assertSchemaName, SchemaNameError } from "./schema-name.ts";

describe("assertSchemaName", () => {
  it.each(["client_bethel_school", "demo_college", "corex_web", "abc"])("accepts %s", (name) => {
    expect(assertSchemaName(name)).toBe(name);
  });

  it.each([
    "public",
    "auth",
    "storage",
    "pg_catalog",
    "_hidden",
    "supabase_x",
    "Client",
    "1client",
    "ab",
    "client-name",
    "client; drop table x",
    "a".repeat(64),
  ])("rejects %s", (name) => {
    expect(() => assertSchemaName(name)).toThrow(SchemaNameError);
  });
});
