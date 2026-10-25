import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";

// Rebuilds the Clinic demo (demo_clinic on the local stack) before the demo tests.
setup("seed the Clinic demo", () => {
  execFileSync("node", ["packages/db/src/cli/demo-seed.ts", "--demo", "clinic"], {
    stdio: "inherit",
  });
});
