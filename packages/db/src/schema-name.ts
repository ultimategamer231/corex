// Schema names are interpolated into SQL (`{{schema}}`), so they are restricted
// to a safe identifier shape and may never collide with Supabase or Postgres schemas.

const SCHEMA_NAME = /^[a-z][a-z0-9_]{2,62}$/;

const RESERVED = new Set([
  "auth",
  "cron",
  "extensions",
  "graphql",
  "graphql_public",
  "information_schema",
  "net",
  "pgbouncer",
  "pgsodium",
  "pgsodium_masks",
  "public",
  "realtime",
  "storage",
  "supabase_functions",
  "supabase_migrations",
  "vault",
]);

const RESERVED_PREFIXES = ["pg_", "_", "supabase_"];

export class SchemaNameError extends Error {
  override name = "SchemaNameError";
}

/** Returns `name` if it is a valid client schema name, otherwise throws. */
export function assertSchemaName(name: string): string {
  if (!SCHEMA_NAME.test(name)) {
    throw new SchemaNameError(
      `Invalid schema name "${name}": use 3-63 lowercase letters, digits or underscores, starting with a letter.`,
    );
  }
  if (RESERVED.has(name) || RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    throw new SchemaNameError(`Schema name "${name}" is reserved.`);
  }
  return name;
}
