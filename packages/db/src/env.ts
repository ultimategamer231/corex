/** Local Supabase database (`pnpm db:local:start`). */
export const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Database URL for a Supabase project: `DATABASE_URL_<PROJECT>` (for example
 * DATABASE_URL_DEMO), then `DATABASE_URL`, then the local stack.
 * Scripts only; never used by an app (SPEC.md 4.2).
 */
export function databaseUrl(project?: string): string {
  const scoped = project ? process.env[`DATABASE_URL_${project.toUpperCase()}`] : undefined;
  return scoped ?? process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
}

export function isLocalDatabase(url: string): boolean {
  return /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
}
