import type * as React from "react";
import { cn } from "../lib/utils";

/** Native select styled like Input; native keeps keyboard and screen reader support. */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "min-h-11 w-full min-w-0 rounded-lg border border-border-strong bg-background px-3 py-2 text-base text-ink",
        "focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
