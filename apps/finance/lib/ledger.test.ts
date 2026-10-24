import { describe, expect, it } from "vitest";
import { baseIncomeExpense, effectOn, type Entry, monthsBetween } from "./ledger";

const entry = (over: Partial<Entry>): Entry => ({
  id: "t1",
  type: "income",
  date: "2026-10-01",
  account_id: "cash",
  to_account_id: null,
  category_id: "sales",
  counterparty_id: null,
  amount_minor: 1_000,
  base_amount_minor: 1_000,
  currency: "USD",
  reversal_of_id: null,
  ...over,
});

describe("ledger effects", () => {
  it("adds income, takes away expenses and moves transfers", () => {
    expect(effectOn(entry({}), "cash")).toBe(1_000);
    expect(effectOn(entry({ type: "expense" }), "cash")).toBe(-1_000);
    const transfer = entry({ type: "transfer", to_account_id: "bank", category_id: null });
    expect(effectOn(transfer, "cash")).toBe(-1_000);
    expect(effectOn(transfer, "bank")).toBe(1_000);
    expect(effectOn(transfer, "other")).toBe(0);
  });

  it("nets a voided entry and its reversal to zero (FIN-05)", () => {
    const original = entry({ type: "expense", amount_minor: 750, base_amount_minor: 750 });
    const reversal = { ...original, id: "t2", reversal_of_id: "t1" };
    expect(effectOn(original, "cash") + effectOn(reversal, "cash")).toBe(0);
    expect(baseIncomeExpense(original).expense + baseIncomeExpense(reversal).expense).toBe(0);
  });

  it("reports in the base currency at the saved rate and leaves transfers out", () => {
    expect(
      baseIncomeExpense(
        entry({ currency: "LRD", amount_minor: 200_000, base_amount_minor: 1_000 }),
      ),
    ).toEqual({
      income: 1_000,
      expense: 0,
    });
    expect(baseIncomeExpense(entry({ type: "transfer", to_account_id: "bank" }))).toEqual({
      income: 0,
      expense: 0,
    });
  });

  it("lists the months of a period across a year end", () => {
    expect(monthsBetween("2025-11-15", "2026-02-01")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
