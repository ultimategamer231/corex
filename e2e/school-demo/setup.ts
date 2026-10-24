import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";

// Rebuilds the College demo (demo_college on the local stack) before the demo tests.
setup("seed the College demo", () => {
  execFileSync("node", ["packages/db/src/cli/demo-seed.ts", "--demo", "college"], {
    stdio: "inherit",
  });
});
