// Helpers shared by the demo seeds (SPEC.md 11.4): dates relative to today, bulk
// inserts inside the reset transaction, and acting as a demo user for functions that
// check the caller's role.
import type { TransactionSql } from "postgres";
import type { Random } from "./random.ts";

export type Value = string | number | boolean | null | Record<string, unknown>;
export type Row = Record<string, Value>;

export type SeedContext = {
  tx: TransactionSql;
  schema: string;
  random: Random;
  /** User ids by account slug (admin, registrar, ..., faculty1, ...). */
  users: Record<string, string>;
};

export const DAY = 86_400_000;

/** Today's date in Monrovia (UTC, no daylight saving) plus `offset` days, as yyyy-mm-dd. */
export function day(offset = 0, now = Date.now()): string {
  return new Date(now + offset * DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function userId(ctx: SeedContext, slug: string): string {
  const id = ctx.users[slug];
  if (!id) throw new Error(`Demo account "${slug}" is missing.`);
  return id;
}

/** Multi-row insert in chunks that stay under Postgres's parameter limit. */
export async function insert(ctx: SeedContext, table: string, rows: Row[]): Promise<void> {
  const first = rows[0];
  if (!first) return;
  const size = Math.max(1, Math.floor(20_000 / Object.keys(first).length));
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await ctx.tx`insert into ${ctx.tx(`${ctx.schema}.${table}`)} ${ctx.tx(chunk)}`;
  }
}

/** Runs `fn` as a signed-in user, for functions that check the caller's role. */
export async function asUser<T>(ctx: SeedContext, id: string, fn: () => Promise<T>): Promise<T> {
  await ctx.tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: id, role: "authenticated" })}, true)`;
  try {
    return await fn();
  } finally {
    await ctx.tx`select set_config('request.jwt.claims', '', true)`;
  }
}
