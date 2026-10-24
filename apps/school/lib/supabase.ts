import type { AuthClient } from "@corex/core/auth";
import { createServerSupabase } from "@corex/core/supabase/server";
import type { Database } from "@corex/db/types/school";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { schoolEnv } from "./env";

export type { Database };

/**
 * Typed client. Every school schema has the same shape, so the types generated from
 * the template schema "school" apply whatever this instance's schema is called.
 */
export type SchoolDb = SupabaseClient<Database, "school">;

/** Supabase as the signed-in user: row-level security applies (CORE-02). */
export async function getSupabase(): Promise<SchoolDb> {
  // Reading cookies first makes every page that uses this render per request,
  // so the instance's environment is read at request time, never at build time.
  const store = await cookies();
  return createServerSupabase(schoolEnv(), store) as unknown as SchoolDb;
}

/**
 * Service-role client for creating users (SPEC.md 5.3). Server only: callers must
 * have checked the Super Admin role first. Never pass it to the browser.
 */
export function getAdminSupabase() {
  const env = schoolEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set for this instance");
  return createClient(env.supabaseUrl, key, {
    db: { schema: env.schema },
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SchoolDb;
}

/** The typed client seen through the small interface the core auth helpers need. */
export function asAuthClient(db: SchoolDb): AuthClient {
  return db as unknown as AuthClient;
}
