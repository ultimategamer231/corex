import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { cn } from "@corex/ui/lib/utils";
import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { money } from "@/lib/clients";
import {
  attentionTag,
  chartSummary,
  mainAndRest,
  MONTHS,
  monthBars,
  perCurrency,
  plural,
  renewalTiming,
  subscriptionState,
  winRate,
} from "@/lib/dashboard";
import {
  attentionItems,
  dashboardFigures,
  recentActivity,
  subscriptionRows,
} from "@/lib/dashboard-data";
import { formatDateTime, formatDay } from "@/lib/format";
import { STAGES } from "@/lib/leads";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const STAGE_COLORS: Record<string, string> = {
  new: "bg-info",
  contacted: "bg-primary",
  demo_booked: "bg-primary-dark",
  quoted: "bg-accent",
  won: "bg-data-1",
  lost: "bg-muted",
};

/** SPEC-ADMIN.md 7 (Main.dc.html, DashboardMobile.dc.html). */
export default async function DashboardPage() {
  const { supabase } = await getAdminSession();
  const [figures, attention, subscriptions, activity] = await Promise.all([
    dashboardFigures(supabase),
    attentionItems(supabase),
    subscriptionRows(supabase),
    recentActivity(supabase),
  ]);
  const { new_leads: leads, pipeline, outstanding, collected } = figures;
  const owed = mainAndRest(outstanding.by_currency);
  const got = mainAndRest(collected.by_currency);
  const month = Number(figures.today.slice(5, 7)) - 1;
  const usd = monthBars(collected.by_month.USD, month);
  const lrd = collected.by_month.LRD ? monthBars(collected.by_month.LRD, month) : null;
  const maxStage = Math.max(1, ...Object.values(pipeline.stages));
  const renewals = subscriptions
    .filter((s) => s.next_renewal_on && !["paused", "ended"].includes(s.state))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">Dashboard</h1>
          <p className="text-[15px] text-muted">
            {longDate.format(new Date(`${figures.today}T00:00:00Z`))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/leads" className={buttonVariants({ variant: "secondary" })}>
            View leads
          </Link>
          <Link href="/invoices/new" className={buttonVariants({ variant: "accent" })}>
            <Plus aria-hidden="true" />
            New invoice
          </Link>
        </div>
      </div>

      <section aria-label="Figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          href="/leads?stage=new"
          label="New leads, last 7 days"
          value={String(leads.count)}
          detail={
            leads.not_contacted > 0 ? `${leads.not_contacted} not contacted yet` : "All contacted"
          }
          tone={leads.not_contacted > 0 ? "warning" : undefined}
        />
        <Figure
          href="/leads"
          label="Open pipeline"
          value={plural(pipeline.open, "lead")}
          detail={
            pipeline.quoted > 0
              ? `${pipeline.quoted} quoted at ${perCurrency(pipeline.quoted_by_currency)}`
              : "No quotes out"
          }
        />
        <Figure
          href={outstanding.overdue > 0 ? "/invoices?status=overdue" : "/invoices"}
          label="Outstanding"
          value={owed.main}
          detail={[
            owed.rest,
            outstanding.overdue > 0
              ? `${plural(outstanding.overdue, "invoice")} overdue`
              : "Nothing overdue",
          ]
            .filter(Boolean)
            .join(" · ")}
          tone={outstanding.overdue > 0 ? "danger" : undefined}
        />
        <Figure
          href="/invoices?tab=receipts"
          label={`Collected in ${collected.year}`}
          value={got.main}
          detail={got.rest ?? "Payments recorded this year"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section
          aria-labelledby="attention-h"
          className="overflow-hidden rounded-xl border border-border bg-background lg:col-span-3"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 id="attention-h" className="font-display text-lg font-bold text-ink">
              Needs attention
            </h2>
            <span className="text-sm text-muted">{plural(attention.length, "item")}</span>
          </div>
          {attention.length === 0 ? (
            <p className="px-5 py-6 text-ink-soft">Nothing needs attention today.</p>
          ) : (
            <ul>
              {attention.map((item, i) => {
                const tag = attentionTag(item.kind);
                return (
                  <li
                    key={`${item.kind}-${i}`}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <Link
                      href={item.href}
                      className="flex min-h-11 items-center gap-3 px-5 py-3.5 hover:bg-surface"
                    >
                      <Badge variant={tag.variant} className="min-w-[5.5rem] justify-center">
                        {tag.tag}
                      </Badge>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-semibold text-ink">{item.title}</span>
                        <span className="text-sm text-ink-soft">{item.detail}</span>
                      </span>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="pipeline-h"
          className="flex flex-col gap-4 rounded-xl border border-border bg-background px-5 pt-4 pb-5 lg:col-span-2"
        >
          <div className="flex items-center justify-between">
            <h2 id="pipeline-h" className="font-display text-lg font-bold text-ink">
              Lead pipeline
            </h2>
            <Link
              href="/leads?view=board"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              Open board
            </Link>
          </div>
          <dl className="flex flex-col gap-3">
            {STAGES.map(([key, label]) => {
              const n = pipeline.stages[key] ?? 0;
              return (
                <div
                  key={key}
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2.5 text-sm"
                >
                  <dt className="font-semibold text-ink-soft">{label}</dt>
                  <dd
                    aria-hidden="true"
                    className="h-3 overflow-hidden rounded-full bg-surface-muted"
                  >
                    <span
                      className={cn("block h-full rounded-full", STAGE_COLORS[key])}
                      style={{ width: `${(n / maxStage) * 100}%` }}
                    />
                  </dd>
                  <dd className="text-right font-bold text-ink">{n}</dd>
                </div>
              );
            })}
          </dl>
          <p className="text-sm text-ink-soft">
            {winRate(pipeline.won_this_year, pipeline.lost_this_year)}
          </p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section
          aria-labelledby="collected-h"
          className="flex flex-col gap-3 rounded-xl border border-border bg-background px-5 pt-4 pb-5 lg:col-span-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="collected-h" className="font-display text-lg font-bold text-ink">
              Collected by month, {collected.year} (USD)
            </h2>
            <span className="text-sm text-muted">LRD payments shown separately</span>
          </div>
          <MonthChart bars={usd} currency="USD" year={collected.year} />
          {lrd ? (
            <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
              <h3 className="text-sm font-semibold text-ink">LRD collected, {collected.year}</h3>
              <p className="text-sm text-ink-soft">
                {lrd
                  .filter((b) => b.minor > 0n)
                  .map((b) => `${b.month}: ${money(b.minor, "LRD")}`)
                  .join(" · ") || "None yet"}
              </p>
            </div>
          ) : null}
        </section>

        <section
          aria-labelledby="renewals-h"
          className="overflow-hidden rounded-xl border border-border bg-background lg:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-2">
            <h2 id="renewals-h" className="font-display text-lg font-bold text-ink">
              Renewals
            </h2>
            <Link
              href="/subscriptions"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              All renewals
            </Link>
          </div>
          {renewals.length === 0 ? (
            <p className="px-5 py-6 text-ink-soft">No renewals scheduled yet.</p>
          ) : (
            <ul>
              {renewals.map((r) => {
                const state = subscriptionState(r.state);
                return (
                  <li
                    key={r.subscription_id}
                    className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5 last:border-0"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/clients/${r.client_id}`}
                        className="inline-flex min-h-11 items-center font-semibold text-ink hover:text-primary hover:underline"
                      >
                        {r.client_name}
                      </Link>
                      <span className="text-sm text-ink-soft">
                        {formatDay(r.next_renewal_on)} · {money(r.renewal_amount_minor, r.currency)}{" "}
                        · {renewalTiming(r.days_to_renewal, r.state, r.pause_flag_on, formatDay)}
                      </span>
                    </span>
                    <Badge variant={state.variant}>{state.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section
        aria-labelledby="activity-h"
        className="overflow-hidden rounded-xl border border-border bg-background"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-2">
          <h2 id="activity-h" className="font-display text-lg font-bold text-ink">
            Recent activity
          </h2>
          <Link
            href="/activity"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
          >
            Activity log
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-6 text-ink-soft">Nothing recorded yet.</p>
        ) : (
          <ol className="px-5 py-2">
            {activity.map((a) => (
              <li key={a.seq} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="text-[15px] text-ink">{a.summary}</span>
                <span className="text-sm whitespace-nowrap text-muted">
                  {formatDateTime(a.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Figure({
  href,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  tone?: "warning" | "danger";
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-border bg-background p-5 hover:border-primary"
    >
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="font-display text-[28px] leading-tight font-bold break-words text-ink">
        {value}
      </span>
      <span
        className={cn(
          "text-sm",
          tone === "danger"
            ? "font-semibold text-danger"
            : tone === "warning"
              ? "font-semibold text-warning"
              : "text-ink-soft",
        )}
      >
        {detail}
      </span>
    </Link>
  );
}

function MonthChart({
  bars,
  currency,
  year,
}: {
  bars: ReturnType<typeof monthBars>;
  currency: string;
  year: number;
}) {
  return (
    <figure aria-label={chartSummary(bars, currency, year)} role="img" className="m-0">
      <div className="flex h-48 items-end gap-1.5 border-b border-border pt-5 sm:gap-2">
        {bars.map((b) => (
          <div
            key={b.month}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span
              aria-hidden="true"
              className="hidden text-[11px] font-semibold whitespace-nowrap text-ink-soft md:block"
            >
              {b.minor > 0n ? money(b.minor, currency).replace(/\.00$/, "") : ""}
            </span>
            <span
              aria-hidden="true"
              className={cn("w-full max-w-10 rounded-t", b.current ? "bg-accent" : "bg-primary")}
              style={{ height: b.minor > 0n ? `max(${b.percent * 0.8}%, 6px)` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-1.5 sm:gap-2">
        {MONTHS.slice(0, bars.length).map((m) => (
          <span key={m} className="flex-1 text-center text-xs text-muted">
            {m}
          </span>
        ))}
      </div>
    </figure>
  );
}
