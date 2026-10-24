import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";
import { SCHEMA } from "./helpers";

// Rebuilds the Finance fixture schema (local Supabase) before the Finance tests.
setup("seed the Finance fixture", () => {
  execFileSync(
    "node",
    ["packages/db/src/cli/fixture.ts", "--schema", SCHEMA, "--product", "finance"],
    { stdio: "inherit" },
  );
});
