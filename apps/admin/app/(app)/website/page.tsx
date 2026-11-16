import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { cn } from "@corex/ui/lib/utils";
import { ChartColumn, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/session";
import {
  analyticsConfig,
  fetchWebsiteStats,
  RANGES,
  rangeFrom,
  type RangeDays,
  type Row,
  type WebsiteStats,
} from "@/lib/website-analytics";

export const metadata: Metadata = { title: "Website visits" };

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
export default async function WebsitePage({ searchParams }: Props) {
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
        title="Website visits"
        description="Visits to www.corexlr.com, counted without cookies by Cloudflare Web Analytics. Numbers refresh every 15 minutes."
      />

      {!config ? (
        <EmptyState
          icon={<ChartColumn aria-hidden="true" />}
          title="Website analytics is not connected yet"
          description="Add the Cloudflare settings to the admin in Vercel (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_WEB_ANALYTICS_SITE_TAG), then redeploy. The steps are in docs/seo.md, step 5."
        />
      ) : (
        <>
          <RangeTabs days={days} />
          {problem || !stats ? (
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
        </>
      )}
    </div>
  );
}

function RangeTabs({ days }: { days: RangeDays }) {
  return (
    <nav aria-label="Period">
      <ul className="flex gap-1 border-b border-border">
        {RANGES.map((d) => (
          <li key={d}>
            <Link
              href={`/website?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 min-w-11 items-center border-b-2 px-3 font-semibold whitespace-nowrap",
                d === days
                  ? "border-primary text-primary"
                  : "border-transparent text-ink-soft hover:text-primary",
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
  const perVisit = stats.visits > 0 ? (stats.views / stats.visits).toFixed(1) : "0";
  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Visits" value={number(stats.visits)} />
        <Stat label="Pages viewed" value={number(stats.views)} />
        <Stat label="Pages per visit" value={perVisit} />
      </dl>
      <DailyChart series={stats.days} days={days} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Most viewed pages" rows={stats.pages} measure="views" />
        <TopList title="Where visitors came from" rows={stats.referrers} measure="visits" />
        <TopList title="Countries" rows={stats.countries} measure="visits" />
        <TopList title="Devices" rows={stats.devices} measure="visits" />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-background p-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold break-words text-ink">{value}</dd>
    </div>
  );
}

/** Visits per day: one bar per day, value on hover, the same numbers in a table for screen readers. */
function DailyChart({ series, days }: { series: WebsiteStats["days"]; days: RangeDays }) {
  const peak = Math.max(0, ...series.map((d) => d.visits));
  const max = Math.max(1, peak);
  const every = days === 7 ? 1 : 5;
  return (
    <section
      aria-labelledby="daily-h"
      className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="daily-h" className="font-display text-lg font-bold text-ink">
          Visits per day
        </h2>
        <p className="text-sm text-muted">Busiest day: {number(peak)} visits</p>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="flex h-44 items-end gap-0.5 border-b border-border-strong">
          {series.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-[4px] bg-primary transition-colors group-hover:bg-primary-dark"
                style={{ height: `${Math.max((d.visits / max) * 100, d.visits > 0 ? 2 : 0)}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                {dayLabel(d.date, "long")}: {number(d.visits)} visits
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-0.5 text-[11px] text-muted">
          {series.map((d, i) => (
            <span key={d.date} className="flex-1 overflow-visible text-center whitespace-nowrap">
              {i % every === 0 ? dayLabel(d.date, "short") : ""}
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
}: {
  title: string;
  rows: Row[];
  measure: "visits" | "views";
}) {
  const max = Math.max(1, ...rows.map((r) => r[measure]));
  const unit = measure === "visits" ? "visits" : "views";
  const id = `top-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:p-5"
    >
      <h2 id={id} className="font-display text-lg font-bold text-ink">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No visits in this period yet.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink" title={r.label}>
                  {r.label}
                </span>
                <span className="shrink-0 font-semibold text-ink">
                  {number(r[measure])} <span className="font-normal text-muted">{unit}</span>
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(r[measure] / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
