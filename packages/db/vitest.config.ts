import { corexVitest } from "@corex/config/vitest";
import { defineConfig } from "vitest/config";

const base = corexVitest();

// Unit tests only. Database tests (*.db.test.ts) need the local Supabase stack: `pnpm test:db`.
export default defineConfig({
  ...base,
  test: { ...base.test, exclude: [...(base.test?.exclude ?? []), "**/*.db.test.ts"] },
});
