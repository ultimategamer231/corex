import { corexVitest } from "@corex/config/vitest";
import { defineConfig } from "vitest/config";

const base = corexVitest();

// Integration tests against the local Supabase stack (`pnpm db:local:start`).
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["**/*.db.test.ts"],
    exclude: ["**/node_modules/**"],
    // Tests share one database and change PostgREST settings; run files one at a time.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
