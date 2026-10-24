import { money } from "./format";

export const RUN_STATUS = {
  draft: { label: "Draft", variant: "neutral" },
  approved: { label: "Approved", variant: "info" },
  paid: { label: "Paid", variant: "brand" },
} as const;

export function runStatus(status: string) {
  return RUN_STATUS[status as keyof typeof RUN_STATUS] ?? RUN_STATUS.draft;
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "October 2026" for a period month stored as 2026-10-01. */
export function monthLabel(periodMonth: string): string {
  return MONTH.format(new Date(`${periodMonth.slice(0, 10)}T00:00:00Z`));
}

/** Net pay per currency, for runs that mix USD and LRD salaries. */
export function totalsByCurrency(slips: { currency: string; net_minor: number | string }[]) {
  const totals = new Map<string, number>();
  for (const s of slips)
    totals.set(s.currency, (totals.get(s.currency) ?? 0) + Number(s.net_minor));
  return [...totals.entries()].sort();
}

/** A component's value as shown: an amount for fixed components, else a percentage. */
export function componentValue(calc: string, value: number | string, currency?: string): string {
  const n = Number(value);
  if (calc !== "fixed") return `${n}% of base`;
  return currency ? money(Math.round(n), currency) : (n / 100).toFixed(2);
}
