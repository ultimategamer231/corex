import type * as React from "react";
import { cn } from "../lib/utils";

/**
 * Horizontally scrollable table container, focusable so keyboard users can scroll
 * it (WCAG 2.1.1). `label` names the region for screen readers.
 */
export function TableScroll({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-x-auto rounded-xl border border-border bg-background",
        className,
      )}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard focusable
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-[15px]", className)} {...props} />;
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border bg-surface px-4 py-3 text-left text-sm font-bold whitespace-nowrap text-ink-soft",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("border-b border-border px-4 py-3 align-top", className)} {...props} />;
}
