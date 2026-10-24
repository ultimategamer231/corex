import { createClient } from "@supabase/supabase-js";
import { LOCAL_PROJECT } from "./env.ts";
import { localSupabaseStatus } from "./local-supabase.ts";

export type SupabaseAdminConfig = { url: string; serviceRoleKey: string };

/**
 * Supabase API URL and service-role key for a project label: the local stack for
 * `local`, otherwise SUPABASE_URL_<LABEL> and SUPABASE_SERVICE_ROLE_KEY_<LABEL>
 * (both required). Scripts and server-only provisioning only (SPEC.md 4.3.6).
 */
export function supabaseAdminConfig(project: string, env = process.env): SupabaseAdminConfig {
  if (project === LOCAL_PROJECT) {
    const status = localSupabaseStatus();
    return { url: status.API_URL, serviceRoleKey: status.SERVICE_ROLE_KEY };
  }
  const suffix = project.toUpperCase();
  const url = env[`SUPABASE_URL_${suffix}`];
  const serviceRoleKey = env[`SUPABASE_SERVICE_ROLE_KEY_${suffix}`];
  if (!url || !serviceRoleKey) {
    throw new Error(
      `Set SUPABASE_URL_${suffix} and SUPABASE_SERVICE_ROLE_KEY_${suffix} for project "${project}".`,
    );
  }
  return { url, serviceRoleKey };
}

/** Service-role Supabase client (scripts and server-only provisioning). */
export type AdminClient = ReturnType<typeof createClient>;

export function supabaseAdmin(config: SupabaseAdminConfig): AdminClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
