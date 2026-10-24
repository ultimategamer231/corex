// Reports (SPEC.md 9.4). Each builds one table that the screen, the PDF and the Excel
// export all render, so exports match on-screen totals for the same filters (FIN-08).
import type { Currency } from "@corex/core/money";
import { loadAccounts, loadCategories, loadCounterparties } from "./finance";
import { baseIncomeExpense, effectOn, type Entry, monthOf, monthsBetween } from "./ledger";
import { rows, selectAll } from "./queries";
import type { FinanceDb } from "./supabase";

export type Period = { from: string; to: string };
export type MoneyCell = { minor: number; currency: string };
export type Cell = string | MoneyCell;
export type ReportTable = {
  /** File name stem for downloads. */
  slug: string;
  title: string;
  subtitle: string;
  columns: { label: string; numeric?: boolean }[];
  rows: Cell[][];
  total?: Cell[];
};

export const REPORTS = {
  summary: "Income and expense summary",
  categories: "Income and expenses by category",
  payroll: "Payroll summary",
  statement: "Account statement",
} as const;
export type ReportKind = keyof typeof REPORTS;

const ENTRY_COLUMNS =
  "id, type, date, account_id, to_account_id, category_id, counterparty_id, amount_minor, base_amount_minor, currency, reversal_of_id, memo";

type EntryRow = Entry & { memo: string | null };

/** Every entry dated in the period, oldest first. */
export async function entriesIn(db: FinanceDb, period: Period): Promise<EntryRow[]> {
  return selectAll<EntryRow>(
    (a, b) =>
      db
        .from("transactions")
        .select(ENTRY_COLUMNS)
        .gte("date", period.from)
        .lte("date", period.to)
        .order("date")
        .order("created_at")
        .range(a, b) as unknown as PromiseLike<{ data: EntryRow[]; error: null }>,
  );
}

const money = (minor: number, currency: string): MoneyCell => ({ minor, currency });

const MONTH = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
/** "Oct 2026" for "2026-10". */
export const monthName = (month: string) => MONTH.format(new Date(`${month}-01T00:00:00Z`));
const periodText = (p: Period) => `${p.from} to ${p.to}`;

/** Income, expenses and net per month, in the base currency (cash basis). */
export async function summaryReport(
  db: FinanceDb,
  period: Period,
  base: Currency,
): Promise<ReportTable> {
  const entries = await entriesIn(db, period);
  const months = new Map(
    monthsBetween(period.from, period.to).map((m) => [m, { income: 0, expense: 0 }]),
  );
  for (const e of entries) {
    const m = months.get(monthOf(e.date));
    if (!m) continue;
    const { income, expense } = baseIncomeExpense(e);
    m.income += income;
    m.expense += expense;
  }
  let income = 0;
  let expense = 0;
  const body: Cell[][] = [...months.entries()].map(([month, t]) => {
    income += t.income;
    expense += t.expense;
    return [
      monthName(month),
      money(t.income, base),
      money(t.expense, base),
      money(t.income - t.expense, base),
    ];
  });
  return {
    slug: "income-expense-summary",
    title: `${REPORTS.summary} (cash basis)`,
    subtitle: `${periodText(period)}, in ${base} at the rate saved on each entry`,
    columns: [
      { label: "Month" },
      { label: "Income", numeric: true },
      { label: "Expenses", numeric: true },
      { label: "Net", numeric: true },
    ],
    rows: body,
    total: ["Total", money(income, base), money(expense, base), money(income - expense, base)],
  };
}

/** Income and expenses per category for the period, in the base currency. */
export async function categoryReport(
  db: FinanceDb,
  period: Period,
  base: Currency,
): Promise<ReportTable> {
  const [entries, categories] = await Promise.all([entriesIn(db, period), loadCategories(db)]);
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (!e.category_id) continue;
    const { income, expense } = baseIncomeExpense(e);
    totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + income + expense);
  }
  const lines = categories
    .filter((c) => totals.has(c.id))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    .map((c) => ({ c, total: totals.get(c.id) ?? 0 }));
  const sum = (type: string) =>
    lines.filter((l) => l.c.type === type).reduce((s, l) => s + l.total, 0);
  return {
    slug: "income-expenses-by-category",
    title: REPORTS.categories,
    subtitle: `${periodText(period)}, in ${base}`,
    columns: [{ label: "Category" }, { label: "Type" }, { label: "Amount", numeric: true }],
    rows: lines.map((l) => [
      l.c.name,
      l.c.type === "income" ? "Income" : "Expense",
      money(l.total, base),
    ]),
    total: ["Net (income less expenses)", "", money(sum("income") - sum("expense"), base)],
  };
}

/** Approved and paid payroll runs in the period, per currency. */
export async function payrollReport(db: FinanceDb, period: Period): Promise<ReportTable> {
  const runs = rows(
    await db
      .from("payroll_runs")
      .select(
        "id, period_month, status, payslips(currency, gross_minor, total_deductions_minor, net_minor)",
      )
      .gte("period_month", `${period.from.slice(0, 7)}-01`)
      .lte("period_month", period.to)
      .neq("status", "draft")
      .order("period_month"),
  );
  const totals = new Map<string, { gross: number; deductions: number; net: number }>();
  const body: Cell[][] = [];
  for (const run of runs) {
    const byCurrency = new Map<
      string,
      { people: number; gross: number; deductions: number; net: number }
    >();
    for (const p of run.payslips) {
      const t = byCurrency.get(p.currency) ?? { people: 0, gross: 0, deductions: 0, net: 0 };
      t.people += 1;
      t.gross += Number(p.gross_minor);
      t.deductions += Number(p.total_deductions_minor);
      t.net += Number(p.net_minor);
      byCurrency.set(p.currency, t);
    }
    for (const [currency, t] of [...byCurrency.entries()].sort()) {
      body.push([
        monthName(run.period_month.slice(0, 7)),
        run.status === "paid" ? "Paid" : "Approved",
        String(t.people),
        money(t.gross, currency),
        money(t.deductions, currency),
        money(t.net, currency),
      ]);
      const sum = totals.get(currency) ?? { gross: 0, deductions: 0, net: 0 };
      sum.gross += t.gross;
      sum.deductions += t.deductions;
      sum.net += t.net;
      totals.set(currency, sum);
    }
  }
  const total = [...totals.entries()].sort();
  return {
    slug: "payroll-summary",
    title: REPORTS.payroll,
    subtitle: periodText(period),
    columns: [
      { label: "Month" },
      { label: "Status" },
      { label: "Payslips", numeric: true },
      { label: "Gross", numeric: true },
      { label: "Deductions", numeric: true },
      { label: "Net pay", numeric: true },
    ],
    rows: [
      ...body,
      ...total.map(([currency, t]): Cell[] => [
        `Total ${currency}`,
        "",
        "",
        money(t.gross, currency),
        money(t.deductions, currency),
        money(t.net, currency),
      ]),
    ],
  };
}

/** Opening balance, every entry with a running balance, and the closing balance. */
export async function statementReport(
  db: FinanceDb,
  accountId: string,
  period: Period,
): Promise<ReportTable | null> {
  const [accounts, categories, counterparties] = await Promise.all([
    loadAccounts(db),
    loadCategories(db),
    loadCounterparties(db),
  ]);
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return null;
  const touches = (e: EntryRow) => e.account_id === accountId || e.to_account_id === accountId;
  const before = await selectAll<EntryRow>(
    (a, b) =>
      db
        .from("transactions")
        .select(ENTRY_COLUMNS)
        .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
        .lt("date", period.from)
        .range(a, b) as unknown as PromiseLike<{ data: EntryRow[]; error: null }>,
  );
  const opening =
    account.opening_balance_minor + before.reduce((s, e) => s + effectOn(e, accountId), 0);
  const names = new Map([...categories, ...counterparties].map((x) => [x.id, x.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  let balance = opening;
  const body: Cell[][] = [];
  for (const e of (await entriesIn(db, period)).filter(touches)) {
    const effect = effectOn(e, accountId);
    balance += effect;
    const what =
      e.type === "transfer"
        ? e.account_id === accountId
          ? `Transfer to ${accountNames.get(e.to_account_id ?? "") ?? ""}`
          : `Transfer from ${accountNames.get(e.account_id) ?? ""}`
        : [names.get(e.category_id ?? ""), names.get(e.counterparty_id ?? "")]
            .filter(Boolean)
            .join(", ");
    body.push([
      e.date,
      [what, e.memo].filter(Boolean).join(": ") + (e.reversal_of_id ? " (reversal)" : ""),
      effect > 0 ? money(effect, account.currency) : "",
      effect < 0 ? money(-effect, account.currency) : "",
      money(balance, account.currency),
    ]);
  }
  return {
    slug: `statement-${account.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: `${REPORTS.statement}: ${account.name}`,
    subtitle: `${periodText(period)}, in ${account.currency}`,
    columns: [
      { label: "Date" },
      { label: "Description" },
      { label: "Money in", numeric: true },
      { label: "Money out", numeric: true },
      { label: "Balance", numeric: true },
    ],
    rows: [["", "Opening balance", "", "", money(opening, account.currency)], ...body],
    total: ["", "Closing balance", "", "", money(balance, account.currency)],
  };
}
