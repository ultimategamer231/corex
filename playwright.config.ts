import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility tests. Run after `pnpm build`:
 *   pnpm test:e2e                 all apps
 *   pnpm test:e2e --project=web   one app
 */
const apps = [
  { name: "web", port: 3000, testDir: "e2e/web" },
  { name: "school", port: 3001, testDir: "e2e/apps" },
  { name: "clinic", port: 3002, testDir: "e2e/apps" },
  { name: "finance", port: 3003, testDir: "e2e/apps" },
] as const;

const ci = Boolean(process.env.CI);

export default defineConfig({
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: apps.map((app) => ({
    name: app.name,
    testDir: app.testDir,
    use: { baseURL: `http://localhost:${app.port}` },
  })),
  webServer: apps.map((app) => ({
    command: `pnpm --filter @corex/${app.name} start`,
    url: `http://localhost:${app.port}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  })),
});
