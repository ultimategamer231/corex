// How an entry moves money (SPEC.md 9.2), mirroring the database's `ledger` view:
// income adds to its account, expense takes away, a transfer takes from one account
// and adds to the other. A void adds an equal opposite reversal, so a voided entry
// and its reversal net to zero while both stay visible (FIN-05).

export type Entry = {
  id: string;
  type: "income" | "expense" | "transfer";
  date: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  counterparty_id: string | null;
  amount_minor: number | string;
  base_amount_minor: number | string;
  currency: string;
  reversal_of_id: string | null;
};

const direction = (e: Pick<Entry, "reversal_of_id">) => (e.reversal_of_id ? -1 : 1);

/** Signed effect on one account, in the account's currency. */
export function effectOn(e: Entry, accountId: string): number {
  const amount = Number(e.amount_minor) * direction(e);
  if (e.account_id === accountId) return e.type === "income" ? amount : -amount;
  if (e.to_account_id === accountId) return amount;
  return 0;
}

/**
 * Income and expense in the base currency at the rate saved on each entry (FIN-03).
 * Transfers are neither.
 */
export function baseIncomeExpense(e: Entry): { income: number; expense: number } {
  const base = Number(e.base_amount_minor) * direction(e);
  if (e.type === "income") return { income: base, expense: 0 };
  if (e.type === "expense") return { income: 0, expense: base };
  return { income: 0, expense: 0 };
}

/** "2026-10" for an ISO date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Every month from `from` to `to` (inclusive), as "YYYY-MM". */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [year, month] = from.slice(0, 7).split("-").map(Number) as [number, number];
  const end = to.slice(0, 7);
  for (let guard = 0; guard < 600; guard++) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > end) break;
    out.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
