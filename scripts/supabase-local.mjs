#!/usr/bin/env node
// Local Supabase stack helper (development only, SPEC.md 2 and 4.4).
//
//   pnpm db:local:start    start the stack (Docker must be running)
//   pnpm db:local:stop     stop it (data is kept in Docker volumes)
//   pnpm db:local:status   print URLs and local keys
//   pnpm db:local:check    verify the API and auth services answer
//
// Images are pulled from Docker Hub by default because some networks block the
// CLI's default registry (public.ecr.aws). Override with SUPABASE_INTERNAL_IMAGE_REGISTRY.
import { spawnSync } from "node:child_process";
import { delimiter, join } from "node:path";

const API_URL = "http://127.0.0.1:54321";
// Services the MVP does not use locally; skipped to save memory and start time.
const EXCLUDED = ["studio", "imgproxy", "postgres-meta", "supavisor"];

const env = {
  ...process.env,
  // Find the CLI installed in node_modules even when not run through pnpm.
  PATH: [join(process.cwd(), "node_modules", ".bin"), process.env.PATH].join(delimiter),
  SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY ?? "docker.io",
};

/** Runs the Supabase CLI; exits with a clear message if it cannot be started. */
function run(args, options) {
  const result = spawnSync("supabase", args, {
    env,
    shell: process.platform === "win32",
    ...options,
  });
  if (result.error) {
    console.error(
      `Could not run the Supabase CLI (${result.error.message}). Run \`pnpm install\` at the repo root.`,
    );
    process.exit(1);
  }
  return result;
}

function supabase(args) {
  const result = run(args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function localKeys() {
  const result = run(["status", "--output", "json"], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error("The local stack is not running. Start it with `pnpm db:local:start`.");
    process.exit(1);
  }
  const start = result.stdout.indexOf("{");
  return JSON.parse(result.stdout.slice(start));
}

async function check() {
  const { ANON_KEY: anonKey } = localKeys();
  const probes = [
    ["auth", `${API_URL}/auth/v1/health`],
    ["rest", `${API_URL}/rest/v1/`],
  ];
  let failed = false;
  for (const [name, url] of probes) {
    try {
      const response = await fetch(url, { headers: { apikey: anonKey } });
      console.log(`${name.padEnd(5)} ${response.status} ${url}`);
      if (!response.ok) failed = true;
    } catch (error) {
      console.log(
        `${name.padEnd(5)} unreachable ${url} (${error instanceof Error ? error.message : String(error)})`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log("Local Supabase is up.");
}

const command = process.argv[2];
switch (command) {
  case "start":
    // After a Docker restart the CLI can see a half-running stack and report it as
    // started. Stopping first (data is kept) makes start reliable.
    run(["stop"], { stdio: "ignore" });
    supabase(["start", "-x", EXCLUDED.join(",")]);
    break;
  case "stop":
    supabase(["stop"]);
    break;
  case "status":
    supabase(["status"]);
    break;
  case "check":
    await check();
    break;
  default:
    console.error("Usage: supabase-local.mjs <start|stop|status|check>");
    process.exit(1);
}
