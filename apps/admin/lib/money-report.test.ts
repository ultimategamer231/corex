import { describe, expect, it } from "vitest";
import { breakdown, expenseSchema, reportYear, yearTotals } from "./money-report";

describe("money report helpers", () => {
  it("totals a year and shows what is left, which can be below zero", () => {
    const months = (v: string) => Array.from({ length: 12 }, (_, i) => (i === 0 ? v : "0"));
    expect(
      yearTotals({
        income: months("5000"),
        expenses: months("7000"),
        by_product: {},
        by_category: {},
      }),
    ).toEqual({ income: 5000n, expenses: 7000n, left: -2000n });
  });

  it("lists a breakdown largest first with whole-percent shares", () => {
    expect(
      breakdown({ hosting: "2000", domains: "6000" }, { hosting: "Hosting", domains: "Domains" }),
    ).toEqual([
      { key: "domains", label: "Domains", amount: 6000n, share: 75 },
      { key: "hosting", label: "Hosting", amount: 2000n, share: 25 },
    ]);
  });

  it("shows this year unless a recent past year is asked for", () => {
    expect(reportYear(undefined, 2026)).toBe(2026);
    expect(reportYear("2025", 2026)).toBe(2026 - 1);
    expect(reportYear("2030", 2026)).toBe(2026);
    expect(reportYear("abc", 2026)).toBe(2026);
  });
});

describe("expenseSchema", () => {
  const base = {
    id: "",
    spentOn: "2026-11-17",
    category: "hosting",
    description: "Vercel Pro",
    currency: "USD",
    amount: "20",
  };
  it("reads the amount in the currency's minor units", () => {
    const parsed = expenseSchema.safeParse(base);
    expect(parsed.success && parsed.data.amountMinor).toBe(2000);
  });
  it("refuses a zero or unreadable amount", () => {
    expect(expenseSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, amount: "twenty" }).success).toBe(false);
  });
});
