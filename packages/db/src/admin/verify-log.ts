import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { assertSchemaName } from "../schema-name.ts";

export type LogRow = {
  seq: bigint | number | string;
  prev_hash: string | null;
  row_hash: string | null;
  canonical: string;
};

export type VerifyResult =
  { ok: true; checked: number } | { ok: false; checked: number; seq: number; reason: string };

/** SHA-256 of the previous hash and the row's canonical text (SPEC-ADMIN.md LOG-02). */
export function chainHash(prevHash: string | null, canonical: string): string {
  return createHash("sha256")
    .update(`${prevHash ?? ""}|${canonical}`, "utf8")
    .digest("hex");
}

/**
 * Checks rows in sequence order: numbers have no gaps, each row points at the hash
 * of the row before it, and each hash matches the row's content. Rows written
 * before the chain existed (no hash) are skipped until the first hashed row.
 */
export function verifyRows(rows: LogRow[]): VerifyResult {
  let previous: { seq: number; hash: string | null } | null = null;
  let checked = 0;
  for (const row of rows) {
    const seq = Number(row.seq);
    if (previous && seq !== previous.seq + 1) {
      return { ok: false, checked, seq, reason: `entry ${previous.seq + 1} is missing` };
    }
    if (row.row_hash === null) {
      if (previous?.hash) return { ok: false, checked, seq, reason: "hash is missing" };
      previous = { seq, hash: null };
      continue;
    }
    if (row.prev_hash !== (previous?.hash ?? null)) {
      return { ok: false, checked, seq, reason: "does not link to the entry before it" };
    }
    if (chainHash(row.prev_hash, row.canonical) !== row.row_hash) {
      return { ok: false, checked, seq, reason: "content does not match its hash" };
    }
    checked += 1;
    previous = { seq, hash: row.row_hash };
  }
  return { ok: true, checked };
}

/** Recomputes the activity log chain of `schema` (`pnpm admin:verify-log`). */
export async function verifyActivityLog(sql: Sql, schema: string): Promise<VerifyResult> {
  assertSchemaName(schema);
  const rows = await sql.unsafe<LogRow[]>(
    `select e.seq, e.prev_hash, e.row_hash, ${schema}.audit_canonical(e) as canonical
     from ${schema}.audit_events e
     order by e.seq`,
  );
  return verifyRows(rows);
}
