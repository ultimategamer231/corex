import { execFileSync } from "node:child_process";
import { test as setup } from "@playwright/test";

// Rebuilds the Finance demo (demo_finance on the local stack) before the demo tests.
setup("seed the Finance demo", () => {
  execFileSync("node", ["packages/db/src/cli/demo-seed.ts", "--demo", "finance"], {
    stdio: "inherit",
  });
});
