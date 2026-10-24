// Rebuilds a public demo (SPEC.md 11.4, 11.5): makes sure the demo sign-ins exist with
// the published password, applies pending migrations plus the demo layer, then in one
// transaction empties every data table and seeds it again. Visitors never see a
// half-built demo: until the transaction commits they keep the old data.
import { randomBytes } from "node:crypto";
import { DEMO_PASSWORD, DEMOS, type DemoInstance, type DemoName } from "@corex/core/demo";
import type { Sql } from "postgres";
import { loadMigrations, migrateSchema, type MigrateResult } from "../migrations.ts";
import { exposeSchemaLocally } from "../provision.ts";
import { assertSchemaName } from "../schema-name.ts";
import type { AdminClient } from "../supabase-admin.ts";
import { seededRandom } from "./random.ts";
import { seedFinance } from "./finance.ts";
import { seedCollege, seedHighSchool, type SeedContext } from "./school.ts";

/**
 * A random password for accounts nobody signs in to, with the upper-case letter,
 * lower-case letter and digit the Auth password rules require.
 */
function unpublishedPassword(): string {
  return `Dx7${randomBytes(24).toString("base64url")}`;
}

/** Fixed seed: the same data on every run (SPEC.md 11.4). */
export const DEMO_SEED = 20_261_024;

const SEEDERS: Record<DemoName, (ctx: SeedContext) => Promise<void>> = {
  college: seedCollege,
  highschool: seedHighSchool,
  finance: seedFinance,
};

/** The main record each demo is counted by in the reset summary. */
const MAIN_TABLE: Record<DemoName, string> = {
  college: "students",
  highschool: "students",
  finance: "transactions",
};

export type ResetResult = {
  schema: string;
  migrations: MigrateResult;
  /** Rows in the demo's main table, for example "300 students". */
  summary: string;
};

/**
 * Creates missing demo users through the Auth API and (re)sets their passwords in SQL:
 * the published password for the listed accounts, a random one for other staff. The
 * demo layer keeps visitors from changing them through the Auth API.
 */
export async function ensureDemoUsers(
  sql: Sql,
  admin: AdminClient,
  demo: DemoInstance,
): Promise<Record<string, string>> {
  const accounts = [...demo.accounts, ...demo.staff];
  const emails = accounts.map((a) => a.email);
  const existing = await sql<{ id: string; email: string }[]>`
    select id, email from auth.users where email = any(${emails})`;
  const ids = new Map(existing.map((u) => [u.email, u.id]));
  for (const account of accounts) {
    if (ids.has(account.email)) continue;
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: unpublishedPassword(),
      email_confirm: true,
      user_metadata: { name: account.name },
    });
    if (error) throw new Error(`Could not create ${account.email}: ${error.message}`);
    ids.set(account.email, data.user.id);
  }
  const published = new Set(demo.accounts.map((a) => a.email));
  for (const account of accounts) {
    const password = published.has(account.email) ? DEMO_PASSWORD : unpublishedPassword();
    await sql`
      update auth.users
      set encrypted_password = extensions.crypt(${password}, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          banned_until = null
      where id = ${ids.get(account.email) ?? null}`;
  }
  return Object.fromEntries(accounts.map((a) => [a.slug, ids.get(a.email) ?? ""]));
}

export async function resetDemo(
  sql: Sql,
  admin: AdminClient,
  name: DemoName,
  options: { exposeLocally?: boolean } = {},
): Promise<ResetResult> {
  const demo = DEMOS[name];
  const s = assertSchemaName(demo.schema);
  const users = await ensureDemoUsers(sql, admin, demo);
  const migrations = await migrateSchema(
    sql,
    s,
    demo.product,
    loadMigrations(demo.product, undefined, { demo: true }),
  );

  const records = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`corex.demo.${s}`}))`;
    await tx.unsafe(`select ${s}.demo_prepare()`);
    const tables = await tx<{ name: string }[]>`
      select c.relname as name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = ${s} and c.relkind in ('r', 'p')
        and c.relname not in ('_migrations', 'document_sequences')`;
    await tx.unsafe(
      `truncate ${tables.map((t) => `${s}."${t.name}"`).join(", ")} restart identity cascade`,
    );
    // Created by the billing migration; numbering starts again from 1.
    await tx.unsafe(`update ${s}.document_sequences set last_number = 0`);
    await tx`select set_config('corex.demo_seeding', 'on', true)`;
    await tx.unsafe(
      `insert into ${s}.memberships (user_id, role, display_name)
       select (a ->> 'id')::uuid, a ->> 'role', a ->> 'name' from jsonb_array_elements($1::text::jsonb) a`,
      [
        JSON.stringify(
          [...demo.accounts, ...demo.staff].map((a) => ({
            id: users[a.slug],
            role: a.role,
            name: a.name,
          })),
        ),
      ],
    );
    await SEEDERS[name]({ tx, schema: s, random: seededRandom(DEMO_SEED), users });
    // Seeding is not activity anyone did; start the audit log empty.
    await tx.unsafe(`truncate ${s}.audit_events`);
    const [count] = await tx.unsafe<{ n: string }[]>(
      `select count(*)::text as n from ${s}.${MAIN_TABLE[name]}`,
    );
    return Number(count?.n ?? 0);
  });

  if (options.exposeLocally) await exposeSchemaLocally(sql, s);
  return { schema: s, migrations, summary: `${records} ${MAIN_TABLE[name]}` };
}
