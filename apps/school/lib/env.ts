import { isDemoMode, type PublicEnv, publicEnv } from "@corex/core/env";

export type Edition = "college" | "highschool";

export type SchoolEnv = PublicEnv & { edition: Edition; demo: boolean };

/** This instance's settings (SPEC.md 4.2). Read at request time, never at build time. */
export function schoolEnv(): SchoolEnv {
  return {
    ...publicEnv({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_DB_SCHEMA: process.env.NEXT_PUBLIC_DB_SCHEMA,
      NEXT_PUBLIC_STORAGE_BUCKET: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
    }),
    edition: process.env.EDITION === "highschool" ? "highschool" : "college",
    demo: isDemoMode(process.env),
  };
}
