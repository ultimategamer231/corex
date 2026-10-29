import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";
import { FIXTURE_FILE, fixture, OWNER_STATE, SCHEMA, signIn } from "./helpers";

// Rebuilds the admin fixture schema (local Supabase) before the admin tests, then signs
// the owner in once and saves the browser state for the tests that start signed in.
setup("seed the admin fixture", async ({ page }) => {
  execFileSync(
    "node",
    [
      "packages/db/src/cli/fixture.ts",
      "--schema",
      SCHEMA,
      "--product",
      "admin",
      "--out",
      FIXTURE_FILE,
    ],
    { stdio: "inherit" },
  );
  await signIn(page, fixture().owner);
  await page.context().storageState({ path: OWNER_STATE });
});
