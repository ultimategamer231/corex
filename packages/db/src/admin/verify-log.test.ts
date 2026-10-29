import { describe, expect, it } from "vitest";
import { chainHash, type LogRow, verifyRows } from "./verify-log.ts";

function at(rows: LogRow[], i: number): LogRow {
  const row = rows[i];
  if (!row) throw new Error(`no row ${i}`);
  return row;
}

function chain(contents: string[]): LogRow[] {
  const rows: LogRow[] = [];
  let prev: string | null = null;
  contents.forEach((canonical, i) => {
    const hash = chainHash(prev, canonical);
    rows.push({ seq: i + 1, prev_hash: prev, row_hash: hash, canonical });
    prev = hash;
  });
  return rows;
}

describe("activity log chain (LOG-02)", () => {
  it("accepts an intact chain", () => {
    expect(verifyRows(chain(["a", "b", "c"]))).toEqual({ ok: true, checked: 3 });
  });

  it("reports the first entry whose content changed", () => {
    const rows = chain(["a", "b", "c"]);
    rows[1] = { ...at(rows, 1), canonical: "B" };
    expect(verifyRows(rows)).toMatchObject({ ok: false, seq: 2, checked: 1 });
  });

  it("reports a removed entry", () => {
    const rows = chain(["a", "b", "c"]);
    expect(verifyRows([at(rows, 0), at(rows, 2)])).toMatchObject({
      ok: false,
      seq: 3,
      reason: "entry 2 is missing",
    });
  });

  it("reports an entry whose hash was recomputed without relinking", () => {
    const rows = chain(["a", "b", "c"]);
    rows[1] = { ...at(rows, 1), canonical: "B", row_hash: chainHash(at(rows, 0).row_hash, "B") };
    const result = verifyRows(rows);
    expect(result).toMatchObject({ ok: false, seq: 3 });
    if (!result.ok) expect(result.reason).toMatch(/link/);
  });

  it("skips entries written before the chain started", () => {
    const legacy: LogRow = { seq: 1, prev_hash: null, row_hash: null, canonical: "x" };
    const rows = chain(["a"]).map((r) => ({ ...r, seq: 2 }));
    expect(verifyRows([legacy, ...rows])).toEqual({ ok: true, checked: 1 });
  });
});
