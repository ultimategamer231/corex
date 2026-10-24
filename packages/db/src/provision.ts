import type { Sql, TransactionSql } from "postgres";
import { migrateSchema, type MigrateResult } from "./migrations.ts";
import { FIRST_ADMIN_ROLE, type Product } from "./products.ts";
import { addToRegistry } from "./registry.ts";
import { assertSchemaName } from "./schema-name.ts";
import type { AdminClient } from "./supabase-admin.ts";

export class ProvisionError extends Error {
  override name = "ProvisionError";
}

export type ProvisionOptions = {
  schema: string;
  product: Product;
  org: string;
  adminEmail: string;
  adminName?: string;
  /** Supabase project label recorded in the registry. */
  project: string;
  /** Where the invite email sends the new administrator. */
  redirectTo?: string;
  /** Local stack only: add the schema to PostgREST's exposed schemas directly. */
  exposeLocally?: boolean;
  registryPath?: string;
};

export type ProvisionResult = {
  migrations: MigrateResult;
  adminUserId: string;
  adminRole: string;
  invited: boolean;
  exposed: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Schemas in this database that already list `userId` as a member, other than `schema`. */
async function otherMemberships(sql: Sql, userId: string, schema: string): Promise<string[]> {
  const schemas = await sql<{ table_schema: string }[]>`
    select table_schema from information_schema.tables
    where table_name = 'memberships' and table_schema <> ${schema}
      and table_schema not in ('auth', 'storage', 'public')`;
  const found: string[] = [];
  for (const { table_schema: other } of schemas) {
    const rows = await sql.unsafe(
      `select 1 from ${assertSchemaName(other)}.memberships where user_id = $1 limit 1`,
      [userId],
    );
    if (rows.length > 0) found.push(other);
  }
  return found;
}

const ALWAYS_EXPOSED = ["public", "graphql_public"];

/** Schemas PostgREST serves, from the authenticator role's `pgrst.db_schemas` setting. */
export async function readExposedSchemas(sql: Sql | TransactionSql): Promise<string[]> {
  const [row] = await sql<{ current: string | null }[]>`
    select (
      select split_part(cfg, '=', 2)
      from pg_db_role_setting s, unnest(s.setconfig) cfg
      where s.setrole = 'authenticator'::regrole and cfg like 'pgrst.db_schemas=%'
      limit 1
    ) as current`;
  return (row?.current ?? ALWAYS_EXPOSED.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Sets the exposed schemas (local stack only); `public` and `graphql_public` always stay. */
export async function writeExposedSchemas(
  sql: Sql | TransactionSql,
  schemas: string[],
): Promise<void> {
  const list = [
    ...new Set([
      ...ALWAYS_EXPOSED,
      ...schemas.map((s) => (ALWAYS_EXPOSED.includes(s) ? s : assertSchemaName(s))),
    ]),
  ];
  await sql.unsafe(`alter role authenticator set pgrst.db_schemas = '${list.join(", ")}'`);
  await sql`notify pgrst, 'reload config'`;
  await sql`notify pgrst, 'reload schema'`;
}

/**
 * Reads, changes and writes the exposed schemas under a lock, so parallel scripts
 * (test setups seeding different schemas) do not drop each other's entries.
 */
async function changeExposedSchemas(
  sql: Sql,
  change: (current: string[]) => string[] | null,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('corex.exposed_schemas'))`;
    const next = change(await readExposedSchemas(tx));
    if (next) await writeExposedSchemas(tx, next);
  });
}

/** Adds `schema` to PostgREST's exposed schemas (local development and tests). */
export async function exposeSchemaLocally(sql: Sql, schema: string): Promise<void> {
  await changeExposedSchemas(sql, (current) =>
    current.includes(schema) ? null : [...current, schema],
  );
}

/** Removes schemas from PostgREST's exposed schemas (local development and tests). */
export async function unexposeSchemasLocally(sql: Sql, ...schemas: string[]): Promise<void> {
  await changeExposedSchemas(sql, (current) => current.filter((s) => !schemas.includes(s)));
}

/**
 * Creates a client schema ready to use (SPEC.md 4.4): migrations, settings row,
 * private storage bucket, first administrator (invited by email) and registry
 * entry. Safe to re-run: completed steps are skipped.
 */
export async function provisionSchema(
  sql: Sql,
  supabase: AdminClient,
  options: ProvisionOptions,
): Promise<ProvisionResult> {
  const schema = assertSchemaName(options.schema);
  const email = options.adminEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ProvisionError(`Invalid admin email "${options.adminEmail}".`);
  if (options.org.trim() === "") throw new ProvisionError("Organization name is required.");

  // One email address can belong to only one client per Supabase project (SPEC.md 4.3.7).
  const [existingUser] = await sql<{ id: string }[]>`
    select id from auth.users where lower(email) = ${email} limit 1`;
  if (existingUser) {
    const others = await otherMemberships(sql, existingUser.id, schema);
    if (others.length > 0) {
      throw new ProvisionError(
        `${email} is already a member of ${others.join(", ")}. In one Supabase project an email can belong to only one client; use another address.`,
      );
    }
  }

  const migrations = await migrateSchema(sql, schema, options.product);

  await sql.unsafe(
    `insert into ${schema}.settings (org_name) values ($1) on conflict (id) do nothing`,
    [options.org.trim()],
  );

  const bucket = await supabase.storage.createBucket(schema, { public: false });
  if (bucket.error && !/already exists/i.test(bucket.error.message)) {
    throw new ProvisionError(
      `Could not create storage bucket "${schema}": ${bucket.error.message}`,
    );
  }

  let adminUserId = existingUser?.id;
  let invited = false;
  if (!adminUserId) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: options.redirectTo,
    });
    if (error) throw new ProvisionError(`Could not invite ${email}: ${error.message}`);
    adminUserId = data.user.id;
    invited = true;
  }
  if (!adminUserId) throw new ProvisionError(`Could not find or create a user for ${email}.`);

  const adminRole = FIRST_ADMIN_ROLE[options.product];
  await sql.unsafe(
    `insert into ${schema}.memberships (user_id, role, status, display_name)
     values ($1, $2, 'active', $3) on conflict (user_id, role) do nothing`,
    [adminUserId, adminRole, options.adminName?.trim() || (email.split("@")[0] ?? email)],
  );

  addToRegistry(
    { schema, product: options.product, project: options.project, org: options.org.trim() },
    options.registryPath,
  );

  if (options.exposeLocally) await exposeSchemaLocally(sql, schema);

  return { migrations, adminUserId, adminRole, invited, exposed: Boolean(options.exposeLocally) };
}
