import Link from "next/link";
import type * as React from "react";
import { cn } from "../lib/utils";

const card = "flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-background p-5";

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

export type Bar = { label: string; value: number; text: string };

/**
 * One series as columns with a scale. The value shows on hover; a hidden table holds
 * every value for screen readers.
 */
export function BarSeries({
  id,
  title,
  caption,
  bars,
  unit,
  className,
}: {
  id: string;
  title: string;
  caption?: string;
  bars: Bar[];
  /** Column heading in the screen-reader table, for example "Collected". */
  unit: string;
  className?: string;
}) {
  const top = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  const ticks = [top, top / 2, 0];
  const compact = (n: number) =>
    n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1_000 ? `${n / 1_000}K` : String(n);
  return (
    <section aria-labelledby={id} className={cn(card, "overflow-hidden", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        {caption ? <p className="text-sm text-muted">{caption}</p> : null}
      </div>
      <div aria-hidden="true" className="grid grid-cols-[auto_1fr] gap-x-3">
        <div className="flex h-40 flex-col justify-between text-right text-xs text-muted tabular-nums">
          {ticks.map((t) => (
            <span key={t}>{compact(t)}</span>
          ))}
        </div>
        <div className="relative h-40">
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
          <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
            {bars.map((b) => (
              <div key={b.label} className="group relative flex h-full min-w-0 flex-1 items-end">
                <div
                  className="w-full rounded-t-[4px] bg-primary transition-colors group-hover:bg-primary-dark"
                  style={{ height: `${Math.max((b.value / top) * 100, b.value > 0 ? 2 : 0)}%` }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow-md group-hover:block">
                  {b.label}: {b.text}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div />
        <div className="mt-2 flex gap-1.5 text-xs text-muted sm:gap-2">
          {bars.map((b) => (
            <span key={b.label} className="min-w-0 flex-1 truncate text-center">
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>{b.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Rows with a count and a bar, largest first: students by program, visits by reason. */
export function ShareList({
  id,
  title,
  rows,
  empty,
  className,
}: {
  id: string;
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section aria-labelledby={id} className={cn(card, className)}>
      <h2 id={id} className="font-display text-lg font-bold text-ink">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink" title={r.label}>
                  {r.label}
                </span>
                <span className="shrink-0 font-semibold text-ink tabular-nums">
                  {r.value.toLocaleString("en-US")}
                </span>
              </div>
              <div aria-hidden="true" className="h-2 rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export type AttentionItem = {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  href: string;
  /** Button text, for example "Review". */
  action: string;
};

/** What is waiting for this person, each with a button that goes straight there. */
export function AttentionList({
  id,
  title = "Needs your attention",
  items,
  empty = "Nothing is waiting for you.",
  className,
}: {
  id: string;
  title?: string;
  items: AttentionItem[];
  empty?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn(card, "gap-2", className)}>
      <h2 id={id} className="font-display text-lg font-bold text-ink">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {items.map((item) => (
            <li key={item.title} className="flex items-center gap-3 py-3">
              <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-tint text-primary [&_svg]:size-5"
              >
                {item.icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-ink">{item.title}</span>
                {item.detail ? <span className="text-sm text-muted">{item.detail}</span> : null}
              </div>
              <Link
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg border-[1.5px] border-border-strong bg-background px-3.5 text-sm font-semibold text-primary hover:border-primary"
              >
                {item.action}
                <span className="sr-only">: {item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
