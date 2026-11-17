import type * as React from "react";
import { cn } from "../lib/utils";

/** Dashboard figure: label, value and optional icon, progress bar and detail. */
export function Stat({
  label,
  value,
  detail,
  icon,
  progress,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  /** Icon element, for example `<Users />`. */
  icon?: React.ReactNode;
  /** 0 to 100: a thin bar under the value, for "collected of billed" figures. */
  progress?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-background p-5",
        className,
      )}
    >
      <p className="flex items-center gap-3 text-sm font-semibold text-muted">
        {icon ? (
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-tint text-primary [&_svg]:size-[18px]"
          >
            {icon}
          </span>
        ) : null}
        {label}
      </p>
      <p className="font-display text-[26px] leading-tight font-bold break-words text-ink">
        {value}
      </p>
      {progress === undefined ? null : (
        <div aria-hidden="true" className="my-1 h-2 rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {detail ? <div className="text-sm text-ink-soft">{detail}</div> : null}
    </div>
  );
}
