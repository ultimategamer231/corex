import type * as React from "react";
import { cn } from "../lib/utils";

/**
 * A list of cards shown instead of a table on phones (below md). Pair it with the table
 * wrapped in `hidden md:block`, so each width shows one of the two.
 */
export function CardList({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ul aria-label={label} className={cn("flex flex-col gap-3 md:hidden", className)}>
      {children}
    </ul>
  );
}

/**
 * One card: `title` (usually the link to the record), an optional `badge` on the right,
 * and lines of detail below.
 */
export function CardListItem({
  title,
  badge,
  children,
}: {
  title: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-border bg-background px-4 py-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">{title}</div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {children ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pb-1 text-sm text-ink-soft">{children}</div>
      ) : null}
    </li>
  );
}
