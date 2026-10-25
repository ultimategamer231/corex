import type { AuthClient } from "@corex/core/auth";
import { createServerSupabase } from "@corex/core/supabase/server";
import type { Database } from "@corex/db/types/clinic";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { clinicEnv } from "./env";

export type { Database };

/**
 * Typed client. Every clinic schema has the same shape, so the types generated from
 * the template schema "clinic" apply whatever this instance's schema is called.
 */
export type ClinicDb = SupabaseClient<Database, "clinic">;

/** Supabase as the signed-in user: row-level security applies (CORE-02). */
export async function getSupabase(): Promise<ClinicDb> {
  // Reading cookies first makes every page that uses this render per request,
  // so the instance's environment is read at request time, never at build time.
  const store = await cookies();
  return createServerSupabase(clinicEnv(), store) as unknown as ClinicDb;
}

/**
 * Service-role client for creating users (SPEC.md 5.3). Server only: callers must
 * have checked the Super Admin role first. Never pass it to the browser.
 */
export function getAdminSupabase() {
  const env = clinicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set for this instance");
  return createClient(env.supabaseUrl, key, {
    db: { schema: env.schema },
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as ClinicDb;
}

/** The typed client seen through the small interface the core auth helpers need. */
export function asAuthClient(db: ClinicDb): AuthClient {
  return db as unknown as AuthClient;
}
