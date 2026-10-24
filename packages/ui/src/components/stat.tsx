import type * as React from "react";
import { cn } from "../lib/utils";

/** Dashboard figure: label, value and optional detail. */
export function Stat({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-background p-5",
        className,
      )}
    >
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="font-display text-[26px] leading-tight font-bold text-ink">{value}</p>
      {detail ? <div className="text-sm text-ink-soft">{detail}</div> : null}
    </div>
  );
}
