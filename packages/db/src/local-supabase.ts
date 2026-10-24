import { spawnSync } from "node:child_process";
import { delimiter, join } from "node:path";
import { z } from "zod";

/** Repository root (packages/db/src -> ../../..). */
export const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

const statusSchema = z.object({
  API_URL: z.string(),
  ANON_KEY: z.string(),
  SERVICE_ROLE_KEY: z.string(),
  STORAGE_S3_URL: z.string(),
  S3_PROTOCOL_ACCESS_KEY_ID: z.string(),
  S3_PROTOCOL_ACCESS_KEY_SECRET: z.string(),
  S3_PROTOCOL_REGION: z.string(),
});

export type LocalSupabaseStatus = z.infer<typeof statusSchema>;

/** URLs and development keys of the running local stack, from `supabase status`. */
export function localSupabaseStatus(): LocalSupabaseStatus {
  const result = spawnSync("supabase", ["status", "--output", "json"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: [join(REPO_ROOT, "node_modules", ".bin"), process.env.PATH].join(delimiter),
    },
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      "The local Supabase stack is not running. Start it with `pnpm db:local:start`.",
    );
  }
  // The CLI can print notices before the JSON object.
  return statusSchema.parse(JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))));
}
