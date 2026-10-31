/**
 * pnpm admin:seed runs only when asked for explicitly and never in production
 * (SPEC-ADMIN.md 13). Returns why it may not run, or null.
 */
export function seedAllowed(env: Record<string, string | undefined>): string | null {
  if (env.ADMIN_ALLOW_SEED !== "true") {
    return "Sample data is loaded only with ADMIN_ALLOW_SEED=true.";
  }
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    return "Sample data is never loaded in production.";
  }
  return null;
}
