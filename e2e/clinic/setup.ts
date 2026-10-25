import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";
import { SCHEMA } from "./helpers";

// Rebuilds the Clinic fixture schema (local Supabase) before the Clinic tests.
setup("seed the Clinic fixture", () => {
  execFileSync(
    "node",
    ["packages/db/src/cli/fixture.ts", "--schema", SCHEMA, "--product", "clinic"],
    { stdio: "inherit" },
  );
});
