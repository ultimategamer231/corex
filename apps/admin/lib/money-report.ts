// Money report and support log (audit round A4, A5). Shared by pages and server actions;
// keep free of server-only imports.
import { type Currency, CURRENCIES, MoneyError, parseMajor } from "@corex/core/money";
import { z } from "zod";
import { isoDate, optionalText, requiredText, uuid } from "./fields";

export const EXPENSE_CATEGORIES = {
  hosting: "Hosting",
  domains: "Domains",
  software: "Software",
  marketing: "Marketing",
  equipment: "Equipment",
  staff: "Staff and transport",
  other: "Other",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const PRODUCT_NAMES: Record<string, string> = {
  school_college: "School: College",
  school_highschool: "School: High School",
  clinic: "Clinic Management",
  finance: "Financial Management",
  custom: "Built on request",
  other: "Other invoices",
};

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const categoryKeys = Object.keys(EXPENSE_CATEGORIES) as [ExpenseCategory, ...ExpenseCategory[]];

export const expenseSchema = z
  .object({
    id: z.union([uuid("an expense"), z.literal("")]).transform((v) => v || null),
    spentOn: isoDate("the date"),
    category: z.enum(categoryKeys, { error: "Choose a category" }),
    description: requiredText("what it was for", 200).pipe(
      z.string().min(2, "Describe it in a few words"),
    ),
    currency: z.enum(CURRENCIES as unknown as [Currency, ...Currency[]], {
      error: "Choose a currency",
    }),
    amount: requiredText("the amount", 20),
    clientId: z
      .union([uuid("a client"), z.literal("")])
      .optional()
      .transform((v) => v || null),
  })
  .transform((v, ctx) => {
    let amountMinor = 0;
    try {
      const minor = parseMajor(v.amount, v.currency).amountMinor;
      if (minor <= 0n) throw new MoneyError("not positive");
      if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError("too large");
      amountMinor = Number(minor);
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Enter an amount like 25 or 25.50",
      });
    }
    return { ...v, amountMinor };
  });

export function expenseRow(data: z.infer<typeof expenseSchema>) {
  return {
    spent_on: data.spentOn,
    category: data.category,
    description: data.description,
    currency: data.currency,
    amount_minor: data.amountMinor,
    client_id: data.clientId,
  };
}

export const SUPPORT_KINDS = { issue: "Issue", request: "Request", question: "Question" } as const;
export const SUPPORT_PRIORITIES = { high: "High", normal: "Normal", low: "Low" } as const;
export const SUPPORT_STATUSES = {
  open: { label: "Open", variant: "warning" },
  in_progress: { label: "In progress", variant: "info" },
  resolved: { label: "Resolved", variant: "brand" },
} as const;
export type SupportStatus = keyof typeof SUPPORT_STATUSES;

export const supportSchema = z.object({
  clientId: uuid("a client"),
  kind: z.enum(["issue", "request", "question"]),
  priority: z.enum(["high", "normal", "low"]),
  title: requiredText("a short title", 160).pipe(z.string().min(3, "Use at least 3 characters")),
  details: optionalText.pipe(z.string().max(2000, "Use at most 2000 characters").nullable()),
});

export const supportUpdateSchema = z.object({
  id: uuid("an item"),
  status: z.enum(["open", "in_progress", "resolved"]),
  priority: z.enum(["high", "normal", "low"]),
  resolution: optionalText.pipe(z.string().max(1000, "Use at most 1000 characters").nullable()),
});

export type CurrencyReport = {
  income: string[];
  expenses: string[];
  by_product: Record<string, string>;
  by_category: Record<string, string>;
};
export type MoneyReport = { year: number; currencies: Record<string, CurrencyReport> };

/** Totals of a year in one currency: income, expenses and what is left (minor units). */
export function yearTotals(r: CurrencyReport) {
  const sum = (values: string[]) => values.reduce((a, b) => a + BigInt(b), 0n);
  const income = sum(r.income);
  const expenses = sum(r.expenses);
  return { income, expenses, left: income - expenses };
}

/** Rows of a breakdown, largest first, with each row's share of the total in percent. */
export function breakdown(values: Record<string, string>, names: Record<string, string>) {
  const rows = Object.entries(values).map(([key, v]) => ({
    key,
    label: names[key] ?? key,
    amount: BigInt(v),
  }));
  const total = rows.reduce((a, r) => a + r.amount, 0n);
  return rows
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
    .map((r) => ({ ...r, share: total > 0n ? Number((r.amount * 100n) / total) : 0 }));
}

/** The year shown: this year unless the address asks for another recent one. */
export function reportYear(value: string | undefined, thisYear: number): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2024 && year <= thisYear ? year : thisYear;
}
