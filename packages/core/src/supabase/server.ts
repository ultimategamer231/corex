import { createServerClient } from "@supabase/ssr";
import type { PublicEnv } from "../env";

/** The parts of a request cookie store Supabase needs (Next.js `cookies()` matches). */
export type CookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

/**
 * Supabase client for Server Components, Server Actions and Route Handlers, acting
 * as the signed-in user so row-level security applies. Every client is created with
 * the instance's schema (SPEC.md 4.2).
 */
export function createServerSupabase(env: PublicEnv, cookies: CookieStore) {
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    db: { schema: env.schema },
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookies.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the middleware refreshes the session.
        }
      },
    },
  });
}

export type ServerSupabase = ReturnType<typeof createServerSupabase>;
