import { createBrowserClient } from "@supabase/ssr";
import type { PublicEnv } from "../env";

/** Supabase client for Client Components, scoped to the instance's schema. */
export function createBrowserSupabase(env: PublicEnv) {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey, { db: { schema: env.schema } });
}
