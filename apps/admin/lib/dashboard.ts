// Dashboard, subscriptions and notifications (SPEC-ADMIN.md 7, 10, 11): the shapes the
// database functions return and how they read on screen. The figures themselves are
// worked out in the database (dashboard_figures, attention_items, subscription_overview).
// Shared by pages and client components; keep free of server-only imports.
import { z } from "zod";
import { money } from "./clients";

const minorText = z.string().regex(/^-?\d+$/);
const byCurrency = z.record(z.string(), minorText);

export const figuresSchema = z.object({
  today: z.string(),
  new_leads: z.object({ count: z.number(), not_contacted: z.number() }),
  pipeline: z.object({
    open: z.number(),
    quoted: z.number(),
    quoted_by_currency: byCurrency,
    stages: z.record(z.string(), z.number()),
    won_this_year: z.number(),
    lost_this_year: z.number(),
  }),
  outstanding: z.object({ by_currency: byCurrency, overdue: z.number() }),
  collected: z.object({
    year: z.number(),
    by_currency: byCurrency,
    by_month: z.record(z.string(), z.array(minorText)),
  }),
});

export type Figures = z.infer<typeof figuresSchema>;

/** USD first, then LRD; never added together (CORE-05). */
const ORDER = ["USD", "LRD"];
function sorted(entries: [string, string][]): [string, string][] {
  return entries.sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

/** "US$1,750.00 · L$35,000.00", or the fallback when there is nothing. */
export function perCurrency(values: Record<string, string>, fallback = "—"): string {
  const parts = sorted(Object.entries(values))
    .filter(([, v]) => BigInt(v) !== 0n)
    .map(([currency, v]) => money(v, currency));
  return parts.length ? parts.join(" · ") : fallback;
}

/** The main figure in one currency (USD unless only LRD has any) and the rest beside it. */
export function mainAndRest(values: Record<string, string>): { main: string; rest: string | null } {
  const parts = sorted(Object.entries(values)).filter(([, v]) => BigInt(v) !== 0n);
  const [first, ...others] = parts;
  if (!first) return { main: money(0, "USD"), rest: null };
  return {
    main: money(first[1], first[0]),
    rest: others.length ? `plus ${others.map(([c, v]) => money(v, c)).join(" and ")}` : null,
  };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Win rate this year: 1 of 2 closed leads (50%)". */
export function winRate(won: number, lost: number): string {
  const closed = won + lost;
  if (closed === 0) return "Win rate this year: no leads closed yet";
  return `Win rate this year: ${won} of ${plural(closed, "closed lead")} (${Math.round((won / closed) * 100)}%)`;
}

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

export type MonthBar = { month: string; minor: bigint; percent: number; current: boolean };

/** Bars for one currency up to the current month; heights relative to the largest. */
export function monthBars(months: string[] | undefined, currentMonth: number): MonthBar[] {
  const values = MONTHS.slice(0, currentMonth + 1).map((_, i) => BigInt(months?.[i] ?? "0"));
  const max = values.reduce((a, b) => (b > a ? b : a), 0n);
  return values.map((minor, i) => ({
    month: MONTHS[i] ?? "",
    minor,
    percent: max === 0n ? 0 : Number((minor * 1000n) / max) / 10,
    current: i === currentMonth,
  }));
}

/** The chart's text alternative: total and the best month. */
export function chartSummary(bars: MonthBar[], currency: string, year: number): string {
  const total = bars.reduce((a, b) => a + b.minor, 0n);
  if (total === 0n) return `No ${currency} payments collected in ${year} yet.`;
  const best = bars.reduce((a, b) => (b.minor > a.minor ? b : a));
  return `${money(total, currency)} collected in ${year}. Highest month: ${best.month}, ${money(best.minor, currency)}.`;
}

// Needs attention ------------------------------------------------------------------

export const ATTENTION_KINDS = {
  overdue: { tag: "Overdue", variant: "danger" },
  pause_flag: { tag: "Pause flag", variant: "danger" },
  follow_up: { tag: "Follow-up", variant: "warning" },
  new_leads: { tag: "New lead", variant: "info" },
  renewal: { tag: "Renewal", variant: "warning" },
  warranty: { tag: "Warranty", variant: "neutral" },
} as const satisfies Record<
  string,
  { tag: string; variant: "danger" | "warning" | "info" | "neutral" }
>;

export type AttentionKind = keyof typeof ATTENTION_KINDS;

export type AttentionItem = {
  kind: AttentionKind;
  title: string;
  detail: string;
  href: string;
  since: string | null;
};

export function attentionTag(kind: string) {
  return ATTENTION_KINDS[kind as AttentionKind] ?? { tag: kind, variant: "neutral" as const };
}

/** Items that started after the admin last opened the notifications. */
export function unreadCount(items: AttentionItem[], seenAt: string | null): number {
  if (!seenAt) return items.length;
  const seen = new Date(seenAt).getTime();
  return items.filter((i) => !i.since || new Date(i.since).getTime() > seen).length;
}

// Subscriptions ---------------------------------------------------------------------

export const SUBSCRIPTION_STATES = {
  active: { label: "Active", variant: "brand" },
  due_soon: { label: "Due soon", variant: "warning" },
  grace: { label: "Grace period", variant: "danger" },
  pause_flag: { label: "Pause flag", variant: "danger" },
  starts_at_go_live: { label: "Starts at go-live", variant: "info" },
  paused: { label: "Paused", variant: "neutral" },
  ended: { label: "Ended", variant: "neutral" },
} as const satisfies Record<
  string,
  { label: string; variant: "brand" | "warning" | "danger" | "info" | "neutral" }
>;

export type SubscriptionState = keyof typeof SUBSCRIPTION_STATES;

export function subscriptionState(state: string) {
  return (
    SUBSCRIPTION_STATES[state as SubscriptionState] ?? { label: state, variant: "neutral" as const }
  );
}

/** "In 22 days", "Today", "12 days overdue · pause flag on 16 Nov". */
export function renewalTiming(
  days: number | null,
  state: string,
  pauseFlagOn: string | null,
  formatDay: (d: string) => string,
): string {
  if (days === null) return state === "starts_at_go_live" ? "Starts at go-live" : "—";
  if (state === "paused" || state === "ended") return "—";
  if (days > 0) return `In ${plural(days, "day")}`;
  if (days === 0) return "Due today";
  const late = `${plural(-days, "day")} overdue`;
  if (state === "pause_flag") return `${late} · pause flag`;
  return pauseFlagOn ? `${late} · pause flag on ${formatDay(pauseFlagOn)}` : late;
}

export type ReminderChip = { label: string; state: "done" | "skipped" | "failed" | "todo" };

/** 30, 14 and 3 days before: the invoice sent, then the two reminders. */
export function reminderChips(row: {
  invoice_status: string | null;
  reminder_14d: string | null;
  reminder_3d: string | null;
}): ReminderChip[] {
  const stage = (label: string, status: string | null): ReminderChip => {
    if (status === "sent") return { label: `${label} sent`, state: "done" };
    if (status === "skipped_disabled") return { label: `${label} not emailed`, state: "skipped" };
    if (status === "failed") return { label: `${label} failed`, state: "failed" };
    if (status === "queued") return { label: `${label} sending`, state: "todo" };
    return { label, state: "todo" };
  };
  const sent = !!row.invoice_status && row.invoice_status !== "draft";
  return [
    { label: sent ? "30d invoice sent" : "30d", state: sent ? "done" : "todo" },
    stage("14d", row.reminder_14d),
    stage("3d", row.reminder_3d),
  ];
}

// Daily job rules (Settings → Renewals) ---------------------------------------------

export const JOB_RULES = [
  [
    "renewal_invoice",
    "Prepare the renewal invoice 30 days before",
    "Uses the client's renewal amount. Sent at once when client email is on; a draft for you to send while it is off.",
  ],
  [
    "reminders",
    "Reminders 14 and 3 days before the due date",
    "Only while the invoice is unpaid. Emailed when client email is on.",
  ],
  [
    "pause_flag",
    "Flag for pause after 30 days overdue",
    "An admin exports the data, sends it and pauses the system. Nothing happens automatically.",
  ],
  [
    "warranty_flag",
    "Warn when a Handover warranty ends within 45 days",
    "A reminder to offer a paid support plan.",
  ],
] as const;

export type JobRule = (typeof JOB_RULES)[number][0];

/** Every rule is on unless switched off. */
export function ruleOn(config: Record<string, unknown> | null | undefined, rule: JobRule): boolean {
  return String(config?.[`job_${rule}`] ?? "true") !== "false";
}
