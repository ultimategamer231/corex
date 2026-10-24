/** Local Supabase database (`pnpm db:local:start`). */
export const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Project label for the local development stack. */
export const LOCAL_PROJECT = "local";

/**
 * Database URL for a Supabase project label (SPEC.md 4.2; scripts only, never an app):
 * - `local`: the local stack.
 * - any other label: DATABASE_URL_<LABEL>, required, so a script never falls back to
 *   another project's database.
 * - no label: DATABASE_URL, else the local stack.
 */
export function databaseUrl(project?: string, env = process.env): string {
  if (project === undefined) return env.DATABASE_URL ?? LOCAL_DATABASE_URL;
  if (project === LOCAL_PROJECT) return LOCAL_DATABASE_URL;
  const key = `DATABASE_URL_${project.toUpperCase()}`;
  const url = env[key];
  if (!url) throw new Error(`${key} is not set (database for project "${project}").`);
  return url;
}

export function isLocalDatabase(url: string): boolean {
  return /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
}
