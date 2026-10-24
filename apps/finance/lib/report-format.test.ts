import { describe, expect, it } from "vitest";
import { formatCell, toSheet } from "./report-format";
import type { ReportTable } from "./reports";

const table: ReportTable = {
  slug: "income-expense-summary",
  title: "Income and expense summary (cash basis)",
  subtitle: "2026-09-01 to 2026-10-31, in USD",
  columns: [
    { label: "Month" },
    { label: "Income", numeric: true },
    { label: "Expenses", numeric: true },
  ],
  rows: [
    ["2026-09", { minor: 120_050, currency: "USD" }, { minor: 45_000, currency: "USD" }],
    ["2026-10", { minor: 80_000, currency: "USD" }, { minor: 99_999, currency: "USD" }],
  ],
  total: ["Total", { minor: 200_050, currency: "USD" }, { minor: 144_999, currency: "USD" }],
};

describe("report exports (FIN-08)", () => {
  it("export the same cells and totals the screen shows", () => {
    const sheet = toSheet(table, "Sample Trading Ltd");
    expect(sheet.columns).toEqual(["Month", "Income", "Expenses"]);
    table.rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        const exported = sheet.rows[r]?.[c];
        if (typeof cell === "string") expect(exported).toBe(cell);
        else expect(exported).toEqual({ value: cell.minor / 100, currency: cell.currency });
      }),
    );
    expect(sheet.total).toEqual([
      "Total",
      { value: 2000.5, currency: "USD" },
      { value: 1449.99, currency: "USD" },
    ]);
    expect(table.total?.map(formatCell)).toEqual(["Total", "US$2,000.50", "US$1,449.99"]);
  });

  it("totals add up to the rows", () => {
    const sum = (i: number) =>
      table.rows.reduce(
        (s, r) => s + (typeof r[i] === "string" ? 0 : (r[i] as { minor: number }).minor),
        0,
      );
    expect(sum(1)).toBe(200_050);
    expect(sum(2)).toBe(144_999);
  });
});
