import { type Currency, isCurrency, MoneyError, parseMajor } from "@corex/core/money";
import { z } from "zod";
import { rows } from "./queries";
import type { FinanceDb } from "./supabase";

export const ACCOUNT_TYPES = { cash: "Cash", bank: "Bank", mobile_money: "Mobile money" } as const;
export const METHODS = {
  cash: "Cash",
  bank: "Bank transfer",
  mobile_money: "Mobile money",
  other: "Other",
} as const;
export const COUNTERPARTY_TYPES = { customer: "Customer", vendor: "Vendor", both: "Both" } as const;

export type AccountRow = {
  id: string;
  name: string;
  type: keyof typeof ACCOUNT_TYPES;
  currency: Currency;
  opening_balance_minor: number;
  opened_on: string;
  active: boolean;
  /** Null when the member cannot see every entry (Staff). */
  balance_minor: number | null;
};

/** Accounts with their computed balances, by name. */
export async function loadAccounts(db: FinanceDb): Promise<AccountRow[]> {
  const [accounts, balances] = await Promise.all([
    db
      .from("accounts")
      .select("id, name, type, currency, opening_balance_minor, opened_on, active")
      .order("name")
      .then(rows),
    db.from("account_balances").select("account_id, balance_minor").then(rows),
  ]);
  const byId = new Map(balances.map((b) => [b.account_id, Number(b.balance_minor)]));
  return accounts.map((a) => ({
    ...a,
    type: a.type as AccountRow["type"],
    currency: a.currency as Currency,
    opening_balance_minor: Number(a.opening_balance_minor),
    balance_minor: byId.get(a.id) ?? null,
  }));
}

export type CategoryRow = { id: string; name: string; type: "income" | "expense"; active: boolean };

export async function loadCategories(db: FinanceDb): Promise<CategoryRow[]> {
  const data = rows(await db.from("categories").select("id, name, type, active").order("name"));
  return data.map((c) => ({ ...c, type: c.type as CategoryRow["type"] }));
}

export type CounterpartyRow = {
  id: string;
  name: string;
  type: keyof typeof COUNTERPARTY_TYPES;
  phone: string | null;
  email: string | null;
};

export async function loadCounterparties(db: FinanceDb): Promise<CounterpartyRow[]> {
  const data = rows(
    await db.from("counterparties").select("id, name, type, phone, email").order("name"),
  );
  return data.map((c) => ({ ...c, type: c.type as CounterpartyRow["type"] }));
}

/** A money amount typed in major units ("1,250.50") as minor units, for `currency`. */
export function toMinor(input: string, currency: string): number {
  if (!isCurrency(currency)) throw new MoneyError("Unknown currency");
  return Number(parseMajor(input.replace(/,/g, ""), currency).amountMinor);
}

/** Form field: an amount greater than zero, kept as typed for conversion per currency. */
export const amountText = z
  .string({ error: "Enter the amount" })
  .trim()
  .regex(/^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/, "Enter an amount like 1250.50")
  .refine((v) => Number(v.replace(/,/g, "")) > 0, "The amount must be greater than zero");

/** Form field: an optional exchange rate to the base currency. */
export const rateText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))
  .refine((v) => v === null || (/^\d+(\.\d{1,6})?$/.test(v) && Number(v) > 0), {
    message: "Enter a rate like 0.005263",
  });
