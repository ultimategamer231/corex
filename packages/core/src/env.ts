import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_DB_SCHEMA: z.string().regex(/^[a-z][a-z0-9_]{2,62}$/, "invalid schema name"),
  NEXT_PUBLIC_STORAGE_BUCKET: z.string().min(1),
});

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  schema: string;
  bucket: string;
};

/**
 * Per-instance settings (SPEC.md 4.2). Each client deployment points at one
 * Supabase project and one schema. Pass `process.env` explicitly so Next.js can
 * inline the NEXT_PUBLIC_ values in browser bundles.
 */
export function publicEnv(env: Record<string, string | undefined>): PublicEnv {
  const parsed = publicEnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`App environment is not configured: ${problems}`);
  }
  const e = parsed.data;
  return {
    supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    schema: e.NEXT_PUBLIC_DB_SCHEMA,
    bucket: e.NEXT_PUBLIC_STORAGE_BUCKET,
  };
}

/** DEMO_MODE=true on the public demo instances (SPEC.md 11.3). */
export function isDemoMode(env: Record<string, string | undefined>): boolean {
  return env.DEMO_MODE === "true";
}
