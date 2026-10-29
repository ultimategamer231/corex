import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility tests. Run after `pnpm build`:
 *   pnpm test:e2e                 all apps
 *   pnpm test:e2e --project=web   one app
 * School, Finance and Clinic run against the local Supabase stack: `pnpm db:local:start`,
 * then `node scripts/school-env.mjs --schema e2e_school`,
 * `node scripts/school-env.mjs --app finance --schema e2e_finance` and
 * `node scripts/school-env.mjs --app clinic --schema e2e_clinic` and
 * `node scripts/school-env.mjs --app admin --schema e2e_admin` before building.
 * Their setup projects rebuild those schemas with fixture data before the tests.
 */
type App = {
  name: string;
  port: number;
  testDir: string;
  /** Workspace package that serves it; defaults to @corex/<name>. */
  app?: string;
  env?: Record<string, string>;
};

const apps: App[] = [
  // The website keeps quote requests in memory under test instead of Supabase.
  { name: "web", port: 3000, testDir: "e2e/web", env: { LEAD_STORE: "memory" } },
  { name: "school", port: 3001, testDir: "e2e/school" },
  // The same School build in the High School edition (EDITION is read at run time).
  {
    name: "school-hs",
    port: 3004,
    testDir: "e2e/school-hs",
    app: "school",
    env: { EDITION: "highschool" },
  },
  // The College build as a public demo: demo mode on the seeded demo_college schema.
  {
    name: "school-demo",
    port: 3005,
    testDir: "e2e/school-demo",
    app: "school",
    env: { DEMO_MODE: "true", DB_SCHEMA: "demo_college" },
  },
  { name: "clinic", port: 3002, testDir: "e2e/clinic" },
  // The Clinic build as its public demo on the seeded demo_clinic schema.
  {
    name: "clinic-demo",
    port: 3007,
    testDir: "e2e/clinic-demo",
    app: "clinic",
    env: { DEMO_MODE: "true", DB_SCHEMA: "demo_clinic" },
  },
  { name: "finance", port: 3003, testDir: "e2e/finance" },
  // Corex Admin (SPEC-ADMIN.md) on the e2e_admin fixture schema.
  { name: "admin", port: 3008, testDir: "e2e/admin" },
  // The Finance build as its public demo on the seeded demo_finance schema.
  {
    name: "finance-demo",
    port: 3006,
    testDir: "e2e/finance-demo",
    app: "finance",
    env: { DEMO_MODE: "true", DB_SCHEMA: "demo_finance" },
  },
];

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
  projects: [
    { name: "school-setup", testDir: "e2e/school", testMatch: /setup\.ts$/ },
    // After the fixture: a demo reset locks its tables, which delays deleting fixture users.
    {
      name: "school-demo-setup",
      testDir: "e2e/school-demo",
      testMatch: /setup\.ts$/,
      dependencies: ["school-setup"],
    },
    // Setups run one after another: a demo reset locks its tables, which delays
    // deleting another fixture's users.
    {
      name: "finance-setup",
      testDir: "e2e/finance",
      testMatch: /setup\.ts$/,
      dependencies: ["school-demo-setup"],
    },
    {
      name: "finance-demo-setup",
      testDir: "e2e/finance-demo",
      testMatch: /setup\.ts$/,
      dependencies: ["finance-setup"],
    },
    {
      name: "clinic-setup",
      testDir: "e2e/clinic",
      testMatch: /setup\.ts$/,
      dependencies: ["finance-demo-setup"],
    },
    {
      name: "admin-setup",
      testDir: "e2e/admin",
      testMatch: /setup\.ts$/,
      use: { baseURL: "http://localhost:3008" },
    },
    {
      name: "clinic-demo-setup",
      testDir: "e2e/clinic-demo",
      testMatch: /setup\.ts$/,
      dependencies: ["clinic-setup"],
    },
    ...apps.map((app) => ({
      name: app.name,
      testDir: app.testDir,
      use: { baseURL: `http://localhost:${app.port}` },
      ...(app.name !== "web"
        ? {
            dependencies: [`${app.name}-setup`.replace("school-hs", "school")],
            testIgnore: /setup\.ts$/,
          }
        : {}),
    })),
  ],
  // Start only the apps under test, so one app can be tested after building only that app.
  webServer: servedApps.map((app) => ({
    command: `pnpm --filter @corex/${app.app ?? app.name} exec next start --port ${app.port}`,
    url: `http://localhost:${app.port}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
    env: app.env ?? {},
  })),
});
