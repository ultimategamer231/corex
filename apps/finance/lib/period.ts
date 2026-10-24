import type { Period } from "./reports";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A valid from/to pair from the URL, else `fallback` (dates are YYYY-MM-DD). */
export function periodFrom(params: { from?: string; to?: string }, fallback: Period): Period {
  const from = params.from && ISO.test(params.from) ? params.from : fallback.from;
  const to = params.to && ISO.test(params.to) ? params.to : fallback.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** The current month up to `today`. */
export function monthToDate(today: string): Period {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** The last twelve months, starting on the first day of the month eleven months back. */
export function lastTwelveMonths(today: string): Period {
  const [year, month] = today.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(year, month - 12, 1));
  return { from: start.toISOString().slice(0, 10), to: today };
}
