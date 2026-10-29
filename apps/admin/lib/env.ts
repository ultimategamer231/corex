import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_DB_SCHEMA: z
    .string()
    .regex(/^[a-z][a-z0-9_]{2,62}$/, "invalid schema name")
    .default("corex_web"),
  NEXT_PUBLIC_ADMIN_URL: z.url().default("http://localhost:3008"),
});

export type AdminEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  schema: string;
  /** Base address for links in emails and copied links, without a trailing slash. */
  adminUrl: string;
};

/**
 * Settings of this admin instance (SPEC-ADMIN.md 2). NEXT_PUBLIC_ values are fixed when
 * the app is built; pass `process.env` entries explicitly so Next.js can inline them.
 */
export function adminEnv(): AdminEnv {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_DB_SCHEMA: process.env.NEXT_PUBLIC_DB_SCHEMA || undefined,
    NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL || undefined,
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Admin environment is not configured: ${problems}`);
  }
  const e = parsed.data;
  return {
    supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    schema: e.NEXT_PUBLIC_DB_SCHEMA,
    adminUrl: e.NEXT_PUBLIC_ADMIN_URL.replace(/\/$/, ""),
  };
}

/** Server-only secret for the "trust this device" cookie (AUTH-06). */
export function trustedDeviceSecret(): string {
  const secret = process.env.TRUSTED_DEVICE_SECRET ?? "";
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") return "development-only-trusted-device-secret!";
  throw new Error("TRUSTED_DEVICE_SECRET must be set (at least 32 characters).");
}
