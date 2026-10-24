import { describe, expect, it } from "vitest";
import { supabaseAdminConfig } from "./supabase-admin.ts";

describe("supabaseAdminConfig", () => {
  it("reads the project's own variables", () => {
    expect(
      supabaseAdminConfig("demo", {
        SUPABASE_URL_DEMO: "https://demo.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY_DEMO: "key",
      }),
    ).toEqual({ url: "https://demo.supabase.co", serviceRoleKey: "key" });
  });

  it("does not fall back to another project's keys", () => {
    expect(() =>
      supabaseAdminConfig("clients", {
        SUPABASE_URL: "https://demo.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "k",
      }),
    ).toThrow(/SUPABASE_URL_CLIENTS/);
  });
});
