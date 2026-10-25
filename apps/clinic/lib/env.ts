import { isDemoMode, type PublicEnv, publicEnv } from "@corex/core/env";

export type ClinicEnv = PublicEnv & { demo: boolean };

/**
 * This instance's settings (SPEC.md 4.2). Read at request time, never at build time.
 * NEXT_PUBLIC_ values are fixed when the app is built; the server-only DB_SCHEMA, when
 * set, overrides the schema at run time (D31).
 */
export function clinicEnv(): ClinicEnv {
  return {
    ...publicEnv({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_DB_SCHEMA: process.env.DB_SCHEMA || process.env.NEXT_PUBLIC_DB_SCHEMA,
      // The bucket is named after the schema (provisioning), so it follows the override.
      NEXT_PUBLIC_STORAGE_BUCKET: process.env.DB_SCHEMA || process.env.NEXT_PUBLIC_STORAGE_BUCKET,
    }),
    demo: isDemoMode(process.env),
  };
}
