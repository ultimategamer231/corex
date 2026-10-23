import type * as React from "react";
import { cn } from "../lib/utils";

/** Loading placeholder shaped like the content it stands in for. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-surface-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
