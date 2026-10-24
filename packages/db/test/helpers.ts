import { randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import { connect } from "../src/db.ts";
import { LOCAL_DATABASE_URL } from "../src/env.ts";

export const fixturesRoot = new URL("./fixtures", import.meta.url).pathname;

/** Connection to the local Supabase database used by integration tests. */
export function testDb(): Sql {
  return connect(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
}

/** A unique, valid schema name so test files never collide. */
export function uniqueSchema(prefix = "test"): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

export async function dropSchemas(sql: Sql, ...schemas: string[]): Promise<void> {
  for (const schema of schemas) {
    await sql.unsafe(`drop schema if exists ${schema} cascade`);
  }
}
