import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";
import { SCHEMA } from "./helpers";

// Rebuilds the College fixture schema (local Supabase) before the School tests.
setup("seed the College fixture", () => {
  execFileSync("node", ["packages/db/src/cli/fixture.ts", "--schema", SCHEMA], {
    stdio: "inherit",
  });
});
