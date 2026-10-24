import type * as React from "react";
import { cn } from "../lib/utils";

type EmptyStateProps = {
  /** Icon element, for example `<Users />`. */
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  /** Optional call to action, for example a Button. */
  action?: React.ReactNode;
  className?: string;
};

/** Empty, not-yet-available or no-results state for lists and sections (CORE-09). */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border-strong bg-background p-6 md:p-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-11 items-center justify-center rounded-xl bg-tint text-primary [&_svg]:size-5"
      >
        {icon}
      </span>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="max-w-prose text-[15px] leading-relaxed text-muted">{description}</div>
      {action}
    </section>
  );
}
