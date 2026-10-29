import type { Database } from "@corex/db/types/admin";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { adminEnv } from "./env";
import { logHeaders, requestContext, type RequestContext } from "./request-context";

export type { Database };

/**
 * Typed client. The types are generated from the template schema "admin"; corex_web has
 * the same shape.
 */
export type AdminDb = SupabaseClient<Database, "admin">;

/**
 * Supabase as the signed-in admin: row-level security applies. The request's address
 * and browser travel with each call for the activity log.
 */
export async function getSupabase(): Promise<AdminDb> {
  // Cookies first: it marks the page as per-request, so builds never read env here.
  const store = await cookies();
  const env = adminEnv();
  const context = await requestContext();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    db: { schema: env.schema },
    global: { headers: logHeaders(context) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the middleware refreshes the session.
        }
      },
    },
  }) as unknown as AdminDb;
}

/**
 * Service-role client for sign-in records, team changes and events. Server only, after
 * the caller's own checks. `actorUserId` names the admin acting, for the activity log.
 */
export function getServiceSupabase(context: RequestContext, actorUserId?: string | null): AdminDb {
  const env = adminEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set for the admin");
  return createClient(env.supabaseUrl, key, {
    db: { schema: env.schema },
    global: { headers: logHeaders(context, actorUserId) },
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as AdminDb;
}
