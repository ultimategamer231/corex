import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql, TransactionSql } from "postgres";
import type { Product } from "./products.ts";
import { assertSchemaName } from "./schema-name.ts";

/** Root of the migration folders: `core/migrations` and `<product>/migrations`. */
export const DEFAULT_MIGRATIONS_ROOT = join(import.meta.dirname, "..");

const FILE_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

export type Migration = {
  /** Stable id recorded in `_migrations`, for example `core/0001_core_tables`. */
  id: string;
  /** SQL with `{{schema}}` placeholders. */
  template: string;
  /** SHA-256 of the template, to detect edits after a migration was applied. */
  checksum: string;
};

export class MigrationError extends Error {
  override name = "MigrationError";
}

/** Replaces `{{schema}}`; rejects any other placeholder so typos fail loudly. */
export function renderMigration(template: string, schema: string): string {
  const rendered = template.replaceAll("{{schema}}", assertSchemaName(schema));
  const leftover = /\{\{\s*[^}]*\}\}/.exec(rendered);
  if (leftover) throw new MigrationError(`Unknown placeholder ${leftover[0]} in migration.`);
  return rendered;
}

function readFolder(root: string, folder: string): Migration[] {
  const dir = join(root, folder, "migrations");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => {
      if (!FILE_NAME.test(file)) {
        throw new MigrationError(`Migration file "${folder}/${file}" must be named NNNN_name.sql.`);
      }
      const template = readFileSync(join(dir, file), "utf8");
      return {
        id: `${folder}/${file.replace(/\.sql$/, "")}`,
        template,
        checksum: createHash("sha256").update(template).digest("hex"),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Core migrations first, then the product's, each folder in file-name order. */
export function loadMigrations(product: Product, root = DEFAULT_MIGRATIONS_ROOT): Migration[] {
  return [...readFolder(root, "core"), ...readFolder(root, product)];
}

export type MigrateResult = { schema: string; applied: string[]; skipped: string[] };

/**
 * Applies pending core + product migrations to one schema in a single
 * transaction (SPEC.md 4.4). Already-applied migrations are skipped; an applied
 * migration whose file changed afterwards stops the run.
 */
export async function migrateSchema(
  sql: Sql,
  schema: string,
  product: Product,
  migrations: Migration[] = loadMigrations(product),
): Promise<MigrateResult> {
  assertSchemaName(schema);
  return sql.begin(async (tx) => {
    // Serialize concurrent runs against the same schema.
    await tx`select pg_advisory_xact_lock(hashtext(${`corex.migrate.${schema}`}))`;
    await tx.unsafe(`create schema if not exists ${schema}`);
    await tx.unsafe(`
      create table if not exists ${schema}._migrations (
        id text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      );
      alter table ${schema}._migrations enable row level security;
      revoke all on ${schema}._migrations from public;
    `);

    const rows = await tx.unsafe<{ id: string; checksum: string }[]>(
      `select id, checksum from ${schema}._migrations`,
    );
    const applied = new Map(rows.map((row) => [row.id, row.checksum]));

    const otherProduct = [...applied.keys()].find(
      (id) => !id.startsWith("core/") && !id.startsWith(`${product}/`),
    );
    if (otherProduct) {
      throw new MigrationError(
        `Schema "${schema}" already has "${otherProduct}"; it cannot also be a ${product} schema.`,
      );
    }

    const result: MigrateResult = { schema, applied: [], skipped: [] };
    for (const migration of migrations) {
      const existing = applied.get(migration.id);
      if (existing !== undefined) {
        if (existing !== migration.checksum) {
          throw new MigrationError(
            `Migration ${migration.id} changed after it was applied to "${schema}". Add a new migration instead of editing it.`,
          );
        }
        result.skipped.push(migration.id);
        continue;
      }
      await tx.unsafe(renderMigration(migration.template, schema));
      await tx.unsafe(`insert into ${schema}._migrations (id, checksum) values ($1, $2)`, [
        migration.id,
        migration.checksum,
      ]);
      result.applied.push(migration.id);
    }
    await enforceSchemaSafety(tx, schema);
    return result;
  });
}

/**
 * Runs inside the migration transaction after every run, so a product migration
 * that forgets a safeguard is rolled back instead of exposing data (SPEC.md 4.3):
 * - Postgres grants EXECUTE on new functions to PUBLIC and that cannot be revoked
 *   per schema, so it is revoked here; functions must be granted explicitly.
 * - Every table must have row-level security (4.3.2).
 * - Views must run with the caller's permissions (security_invoker), otherwise they
 *   would read tables as their owner and bypass row-level security.
 */
async function enforceSchemaSafety(tx: TransactionSql, schema: string): Promise<void> {
  await tx.unsafe(`revoke execute on all functions in schema ${schema} from public, anon`);

  const unprotected = await tx<{ name: string }[]>`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relkind in ('r', 'p') and not c.relrowsecurity`;
  if (unprotected.length > 0) {
    throw new MigrationError(
      `Row-level security is not enabled on ${unprotected.map((t) => `${schema}.${t.name}`).join(", ")}. Add "alter table ... enable row level security" to the migration.`,
    );
  }

  const definerViews = await tx<{ name: string }[]>`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relkind in ('v', 'm')
      and not coalesce(
        (select option_value::boolean from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'),
        false
      )`;
  if (definerViews.length > 0) {
    throw new MigrationError(
      `Views must use "with (security_invoker = true)" so row-level security applies: ${definerViews.map((v) => `${schema}.${v.name}`).join(", ")}.`,
    );
  }
}
