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

/** Projects named with --project on the command line; empty means all. */
function selectedProjects(argv: string[]): string[] {
  return argv.flatMap((arg, i) => {
    if (arg.startsWith("--project=")) return [arg.slice("--project=".length)];
    if (arg === "--project") return argv[i + 1] ? [argv[i + 1] as string] : [];
    return [];
  });
}

const selected = selectedProjects(process.argv);
const servedApps = apps.filter((app) => selected.length === 0 || selected.includes(app.name));

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
  // Start only the apps under test, so one app can be tested after building only that app.
  webServer: servedApps.map((app) => ({
    command: `pnpm --filter @corex/${app.name} start`,
    url: `http://localhost:${app.port}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
    // The website keeps quote requests in memory under test instead of Supabase.
    env: app.name === "web" ? { LEAD_STORE: "memory" } : ({} as Record<string, string>),
  })),
});
