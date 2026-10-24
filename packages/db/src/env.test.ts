import { describe, expect, it } from "vitest";
import { databaseUrl, isLocalDatabase, LOCAL_DATABASE_URL } from "./env.ts";

describe("databaseUrl", () => {
  it("requires the project's own variable and never borrows another project's", () => {
    expect(
      databaseUrl("demo", {
        DATABASE_URL_DEMO: "postgresql://demo",
        DATABASE_URL: "postgresql://x",
      }),
    ).toBe("postgresql://demo");
    expect(() => databaseUrl("clients", { DATABASE_URL: "postgresql://demo" })).toThrow(
      /DATABASE_URL_CLIENTS/,
    );
  });

  it("uses the local stack for the local project, ignoring DATABASE_URL", () => {
    expect(databaseUrl("local", { DATABASE_URL: "postgresql://remote" })).toBe(LOCAL_DATABASE_URL);
  });

  it("uses DATABASE_URL, then the local stack, when no project is named", () => {
    expect(databaseUrl(undefined, { DATABASE_URL: "postgresql://x" })).toBe("postgresql://x");
    expect(databaseUrl(undefined, {})).toBe(LOCAL_DATABASE_URL);
  });

  it("recognises local URLs", () => {
    expect(isLocalDatabase(LOCAL_DATABASE_URL)).toBe(true);
    expect(isLocalDatabase("postgresql://u:p@db.xyz.supabase.co:5432/postgres")).toBe(false);
  });
});
