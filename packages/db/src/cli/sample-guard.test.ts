import { describe, expect, it } from "vitest";
import { seedAllowed } from "./sample-guard.ts";

describe("admin:seed guard (SPEC-ADMIN.md 13)", () => {
  it("runs only with ADMIN_ALLOW_SEED=true", () => {
    expect(seedAllowed({})).toMatch(/ADMIN_ALLOW_SEED=true/);
    expect(seedAllowed({ ADMIN_ALLOW_SEED: "1" })).toMatch(/ADMIN_ALLOW_SEED=true/);
    expect(seedAllowed({ ADMIN_ALLOW_SEED: "true" })).toBeNull();
  });

  it("never runs in production", () => {
    expect(seedAllowed({ ADMIN_ALLOW_SEED: "true", NODE_ENV: "production" })).toMatch(/never/);
    expect(seedAllowed({ ADMIN_ALLOW_SEED: "true", VERCEL_ENV: "production" })).toMatch(/never/);
  });
});
