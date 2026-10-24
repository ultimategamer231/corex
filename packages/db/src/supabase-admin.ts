import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type SupabaseAdminConfig = { url: string; serviceRoleKey: string };

/**
 * Supabase API URL and service-role key for a project: SUPABASE_URL_<PROJECT> and
 * SUPABASE_SERVICE_ROLE_KEY_<PROJECT>, then the unscoped variables. For the local
 * stack they are read from the Supabase CLI. Scripts only (SPEC.md 4.3.6).
 */
export function supabaseAdminConfig(project?: string, local = false): SupabaseAdminConfig {
  const suffix = project ? `_${project.toUpperCase()}` : "";
  const url = process.env[`SUPABASE_URL${suffix}`] ?? process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env[`SUPABASE_SERVICE_ROLE_KEY${suffix}`] ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceRoleKey) return { url, serviceRoleKey };
  if (!local) {
    throw new Error(
      `Set SUPABASE_URL${suffix} and SUPABASE_SERVICE_ROLE_KEY${suffix} (or the unscoped variables).`,
    );
  }
  const result = spawnSync("supabase", ["status", "--output", "json"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(
      "Could not read local Supabase keys. Is the stack running? (pnpm db:local:start)",
    );
  }
  const status = z
    .object({ API_URL: z.string(), SERVICE_ROLE_KEY: z.string() })
    .parse(JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))));
  return { url: status.API_URL, serviceRoleKey: status.SERVICE_ROLE_KEY };
}

/** Service-role Supabase client (scripts and server-only provisioning). */
export type AdminClient = ReturnType<typeof createClient>;

export function supabaseAdmin(config: SupabaseAdminConfig): AdminClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
