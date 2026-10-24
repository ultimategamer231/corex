#!/usr/bin/env node
// Writes apps/school/.env.local and .env.production.local for a local schema, with
// the local Supabase stack's development keys (never real ones). Next.js reads
// these files for `dev`, `build` and `start`; both are git-ignored.
//   node scripts/school-env.mjs --schema dev_school [--edition college]
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { schema: { type: "string" }, edition: { type: "string" } },
});
if (!values.schema || !/^[a-z][a-z0-9_]{2,62}$/.test(values.schema)) {
  console.error(
    "Usage: node scripts/school-env.mjs --schema <name> [--edition college|highschool]",
  );
  process.exit(2);
}
const status = spawnSync("node", ["scripts/supabase-local.mjs", "status"], { encoding: "utf8" });
const json = status.stdout.slice(status.stdout.indexOf("{"));
const local = JSON.parse(json);
const env = [
  "# Written by scripts/school-env.mjs for the local Supabase stack. Do not commit.",
  `NEXT_PUBLIC_SUPABASE_URL=${local.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${local.ANON_KEY}`,
  `SUPABASE_SERVICE_ROLE_KEY=${local.SERVICE_ROLE_KEY}`,
  `NEXT_PUBLIC_DB_SCHEMA=${values.schema}`,
  `NEXT_PUBLIC_STORAGE_BUCKET=${values.schema}`,
  `EDITION=${values.edition ?? "college"}`,
  "DEMO_MODE=false",
  "APP_URL=http://localhost:3001",
  "",
].join("\n");
for (const file of [".env.local", ".env.production.local"])
  writeFileSync(join("apps", "school", file), env);
console.log(`Wrote apps/school/.env.local and .env.production.local for ${values.schema}`);
