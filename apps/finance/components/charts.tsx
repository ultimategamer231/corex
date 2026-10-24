"use client";

import { useState } from "react";

export type MonthBar = {
  /** "Oct 2026" */
  label: string;
  /** Short axis label: "Oct". */
  short: string;
  income: number;
  expense: number;
  incomeText: string;
  expenseText: string;
};

const HEIGHT = 160;

function compact(value: number): string {
  const major = value / 100;
  if (major >= 1_000_000) return `${Math.round(major / 100_000) / 10}M`;
  if (major >= 1_000) return `${Math.round(major / 100) / 10}K`;
  return String(Math.round(major));
}

/**
 * Income and expenses per month as paired columns (SPEC.md 9.4). Each month is a
 * button: hover or focus shows both values; the table below holds every value.
 */
export function IncomeExpenseChart({ months, currency }: { months: MonthBar[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const shown = active === null ? null : months[active];
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-[3px] bg-data-1" aria-hidden="true" />
          Income
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-[3px] bg-data-2" aria-hidden="true" />
          Expenses
        </span>
        <span className="text-muted">In {currency}</span>
      </div>
      <p className="min-h-6 text-sm" aria-live="polite">
        {shown ? (
          <>
            <span className="font-semibold">{shown.label}:</span> income{" "}
            <span className="font-bold">{shown.incomeText}</span>, expenses{" "}
            <span className="font-bold">{shown.expenseText}</span>
          </>
        ) : (
          <span className="text-muted">Point at or tab to a month to see its totals.</span>
        )}
      </p>
      {/* Scrolls on its own on narrow screens so every month keeps a 44px target. */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[36rem] gap-0" style={{ height: HEIGHT + 28 }}>
          <div
            className="flex w-10 shrink-0 flex-col justify-between pb-7 text-right text-xs text-muted"
            aria-hidden="true"
          >
            <span>{compact(max)}</span>
            <span>{compact(max / 2)}</span>
            <span>0</span>
          </div>
          <div className="relative flex flex-1 items-end border-b border-border pl-2">
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border-subtle" />
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-border-subtle"
              style={{ top: HEIGHT / 2 }}
            />
            {months.map((m, i) => (
              <button
                key={m.label}
                type="button"
                aria-label={`${m.label}: income ${m.incomeText}, expenses ${m.expenseText}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex min-w-11 flex-1 flex-col items-center justify-end rounded-md outline-offset-2"
                style={{ height: HEIGHT + 28 }}
              >
                <span
                  className="flex items-end gap-0.5 group-hover:opacity-80 group-focus-visible:opacity-80"
                  style={{ height: HEIGHT }}
                >
                  <span
                    className="w-3.5 rounded-t-[4px] bg-data-1 sm:w-4"
                    style={{ height: Math.max(m.income > 0 ? 2 : 0, (m.income / max) * HEIGHT) }}
                  />
                  <span
                    className="w-3.5 rounded-t-[4px] bg-data-2 sm:w-4"
                    style={{ height: Math.max(m.expense > 0 ? 2 : 0, (m.expense / max) * HEIGHT) }}
                  />
                </span>
                <span className="mt-1 h-6 text-xs text-muted" aria-hidden="true">
                  {m.short}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">Income and expenses per month in {currency}</figcaption>
    </figure>
  );
}

export type CategoryBar = { label: string; value: number; valueText: string };

/** One series of horizontal bars with the value at each tip. */
export function CategoryChart({ items, label }: { items: CategoryBar[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item.label}
            className="grid grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)_auto] items-center gap-3"
          >
            <span className="truncate text-sm text-ink-soft">{item.label}</span>
            <span className="min-w-0" aria-hidden="true">
              <span
                className="block h-4 rounded-r-[4px] bg-data-2"
                style={{ width: `${Math.max(1, (item.value / max) * 100)}%` }}
              />
            </span>
            <span className="text-right text-sm font-semibold whitespace-nowrap">
              {item.valueText}
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
