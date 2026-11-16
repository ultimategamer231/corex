import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { cn } from "@corex/ui/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartColumn,
  ExternalLink,
  Eye,
  Files,
  Smartphone,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type * as React from "react";
import { getAdminSession } from "@/lib/session";
import {
  analyticsConfig,
  change,
  fetchWebsiteStats,
  RANGES,
  rangeFrom,
  type RangeDays,
  type Row,
  type WebsiteStats,
} from "@/lib/website-analytics";

export const metadata: Metadata = { title: "Analytics" };

type Props = { searchParams: Promise<{ days?: string }> };

const number = (n: number) => n.toLocaleString("en-US");

const dayLabel = (date: string, style: "short" | "long") =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(style === "long" ? { weekday: "short" } : {}),
  });

/** Visits to www.corexlr.com from Cloudflare Web Analytics (docs/seo.md, step 5). */
export default async function AnalyticsPage({ searchParams }: Props) {
  await getAdminSession();
  const days = rangeFrom((await searchParams).days);
  const config = analyticsConfig(process.env);

  let stats: WebsiteStats | null = null;
  let problem: string | null = null;
  if (config) {
    try {
      stats = await fetchWebsiteStats(config, days);
    } catch (error) {
      problem = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Analytics"
        description="Visits to www.corexlr.com, counted without cookies by Cloudflare Web Analytics."
        actions={
          config ? (
            <>
              <RangeSwitch days={days} />
              <a
                href={`https://dash.cloudflare.com/${config.accountId}/web-analytics/overview?siteTag~in=${config.siteTag}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-strong bg-background px-3.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
              >
                Open in Cloudflare
                <ExternalLink className="size-4" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </>
          ) : null
        }
      />

      {!config ? (
        <EmptyState
          icon={<ChartColumn aria-hidden="true" />}
          title="Analytics is not connected yet"
          description="Add the Cloudflare settings to the admin in Vercel (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_WEB_ANALYTICS_SITE_TAG), then redeploy. The steps are in docs/seo.md, step 5."
        />
      ) : problem || !stats ? (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger bg-danger-subtle px-5 py-4 text-danger"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Could not load the numbers from Cloudflare.</strong> {problem}
          </span>
        </p>
      ) : (
        <Report stats={stats} days={days} />
      )}
    </div>
  );
}

/** 7 or 30 days as a segmented control of links; the current one is marked for screen readers. */
function RangeSwitch({ days }: { days: RangeDays }) {
  return (
    <nav aria-label="Period">
      <ul className="flex rounded-lg border border-border-strong bg-surface-muted p-0.5">
        {RANGES.map((d) => (
          <li key={d}>
            <Link
              href={`/analytics?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-sm font-semibold whitespace-nowrap",
                d === days
                  ? "bg-background text-primary shadow-sm"
                  : "text-ink-soft hover:text-primary",
              )}
            >
              Last {d} days
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Report({ stats, days }: { stats: WebsiteStats; days: RangeDays }) {
  const perVisit = (v: number, p: number) => (v > 0 ? p / v : 0);
  const devicesTotal = stats.devices.reduce((sum, r) => sum + r.views, 0);
  const phones = stats.devices.find((r) => r.label === "Phone")?.views ?? 0;
  const vs = `vs previous ${days} days`;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          icon={<Users />}
          label="Visits"
          value={number(stats.visits)}
          delta={change(stats.visits, stats.previous.visits)}
          vs={vs}
        />
        <Stat
          icon={<Eye />}
          label="Pages viewed"
          value={number(stats.views)}
          delta={change(stats.views, stats.previous.views)}
          vs={vs}
        />
        <Stat
          icon={<Files />}
          label="Pages per visit"
          value={perVisit(stats.visits, stats.views).toFixed(1)}
          delta={change(
            perVisit(stats.visits, stats.views),
            perVisit(stats.previous.visits, stats.previous.views),
          )}
          vs={vs}
        />
        <Stat
          icon={<Smartphone />}
          label="Viewed on phones"
          value={devicesTotal > 0 ? `${Math.round((phones / devicesTotal) * 100)}%` : "0%"}
          note="Share of pages viewed"
        />
      </dl>
      <DailyChart series={stats.days} days={days} total={stats.visits} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopList
          title="Most viewed pages"
          rows={stats.pages}
          measure="views"
          empty="No pages viewed in this period yet."
        />
        <TopList
          title="Where visitors came from"
          rows={stats.referrers}
          measure="visits"
          empty="No visits from other websites in this period yet."
        />
        <TopList
          title="Countries"
          rows={stats.countries}
          measure="views"
          empty="No country information in this period yet."
        />
        <TopList
          title="Devices"
          rows={stats.devices}
          measure="views"
          empty="No device information in this period yet."
        />
      </div>
      <p className="text-sm text-muted">
        Cloudflare counts a sample of page loads, so small numbers are estimates. Numbers refresh
        every 15 minutes.
      </p>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  delta,
  vs,
  note,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
  delta?: number | null;
  vs?: string;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-background p-4 sm:p-5">
      <dt className="flex items-center gap-3 text-sm font-semibold text-muted">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-tint text-primary [&_svg]:size-[18px]"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 font-display text-[28px] leading-tight font-bold break-words text-ink">
        {value}
      </dd>
      <dd className="text-sm text-muted">
        {note ??
          (delta === null || delta === undefined ? (
            <>No visits to compare {vs?.replace("vs", "with the")}</>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  delta < 0 ? "text-danger" : "text-primary",
                )}
              >
                {delta < 0 ? (
                  <ArrowDownRight className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                )}
                {delta < 0 ? "Down" : "Up"} {Math.abs(delta)}%
              </span>
              {vs}
            </span>
          ))}
      </dd>
    </div>
  );
}

/** A rounded axis top (1, 2, 5 × 10ⁿ) so the gridlines read as whole numbers. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

/** Visits per day: one bar per day, value on hover, the same numbers in a table for screen readers. */
function DailyChart({
  series,
  days,
  total,
}: {
  series: WebsiteStats["days"];
  days: RangeDays;
  total: number;
}) {
  const peak = Math.max(0, ...series.map((d) => d.visits));
  const top = niceMax(peak);
  const ticks = [top, top / 2, 0];
  const every = days === 7 ? 1 : 5;
  return (
    <section
      aria-labelledby="daily-h"
      className="flex flex-col gap-5 rounded-xl border border-border bg-background p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="daily-h" className="font-display text-lg font-bold text-ink">
            Visits per day
          </h2>
          <p className="text-sm text-muted">
            {number(total)} visits in the last {days} days · busiest day {number(peak)}
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />
          Visits
        </p>
      </div>
      <div aria-hidden="true" className="grid grid-cols-[auto_1fr] gap-x-3">
        <div className="flex h-48 flex-col justify-between text-right text-xs text-muted tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {number(t)}
            </span>
          ))}
        </div>
        <div className="relative h-48">
          {ticks.map((t) => (
            <div
              key={t}
              className={cn(
                "absolute inset-x-0 border-t",
                t === 0 ? "border-border-strong" : "border-dashed border-border-subtle",
              )}
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {series.map((d) => (
              <div key={d.date} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[4px] bg-primary transition-colors group-hover:bg-primary-dark"
                  style={{
                    height: `${Math.max((d.visits / top) * 100, d.visits > 0 ? 2 : 0)}%`,
                  }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow-md group-hover:block">
                  {dayLabel(d.date, "long")}: {number(d.visits)} visits, {number(d.views)} pages
                </span>
              </div>
            ))}
          </div>
        </div>
        <div />
        <div className="mt-2 flex gap-[3px] text-[11px] text-muted">
          {series.map((d, i) => (
            <span key={d.date} className="flex-1 text-center whitespace-nowrap">
              {i % every === 0 || i === series.length - 1 ? dayLabel(d.date, "short") : ""}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Visits per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Visits</th>
            <th scope="col">Pages viewed</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date, "long")}</th>
              <td>{d.visits}</td>
              <td>{d.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TopList({
  title,
  rows,
  measure,
  empty,
}: {
  title: string;
  rows: Row[];
  measure: "visits" | "views";
  empty: string;
}) {
  const total = rows.reduce((sum, r) => sum + r[measure], 0);
  const max = Math.max(1, ...rows.map((r) => r[measure]));
  const unit = measure === "visits" ? "visits" : "pages viewed";
  const id = `top-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">{unit}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-4 py-6 text-center text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r) => {
            const share = total > 0 ? Math.round((r[measure] / total) * 100) : 0;
            return (
              <li key={r.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink" title={r.label}>
                    {r.label}
                  </span>
                  <span className="shrink-0 text-ink tabular-nums">
                    <span className="font-semibold">{number(r[measure])}</span>
                    <span className="ml-2 inline-block w-10 text-right text-muted">{share}%</span>
                  </span>
                </div>
                <div aria-hidden="true" className="h-2 rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(r[measure] / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
