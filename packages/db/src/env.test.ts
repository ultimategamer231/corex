import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseUrl, isLocalDatabase, LOCAL_DATABASE_URL } from "./env.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("databaseUrl", () => {
  it("prefers the project-scoped variable", () => {
    vi.stubEnv("DATABASE_URL_DEMO", "postgresql://demo");
    vi.stubEnv("DATABASE_URL", "postgresql://default");
    expect(databaseUrl("demo")).toBe("postgresql://demo");
    expect(databaseUrl("other")).toBe("postgresql://default");
  });

  it("falls back to the local stack", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    expect(databaseUrl()).toBe(LOCAL_DATABASE_URL);
    expect(isLocalDatabase(LOCAL_DATABASE_URL)).toBe(true);
    expect(isLocalDatabase("postgresql://u:p@db.xyz.supabase.co:5432/postgres")).toBe(false);
  });
});
