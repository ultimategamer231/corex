import { formatDate as formatDateTz } from "@corex/core/dates";
import { CURRENCIES, formatMoney, type Currency } from "@corex/core/money";

export { formatMoney };

/** Money from a bigint-as-string database value (CORE-04). */
export function money(
  amountMinor: string | number | bigint | null | undefined,
  currency: string,
): string {
  if (!CURRENCIES.includes(currency as Currency)) return String(amountMinor ?? "");
  return formatMoney({ amountMinor: BigInt(amountMinor ?? 0), currency: currency as Currency });
}

export function date(value: string | null | undefined, timezone = "Africa/Monrovia"): string {
  return value ? formatDateTz(value, timezone) : "-";
}

export function personName(p: {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
}): string {
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
}

/** Today's date (YYYY-MM-DD) in the organization's time zone. */
export function todayIso(timezone = "Africa/Monrovia", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

export function percent(part: number, whole: number): string {
  return whole === 0 ? "-" : `${Math.round((part / whole) * 100)}%`;
}
