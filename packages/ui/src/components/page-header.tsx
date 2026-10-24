import type * as React from "react";
import { cn } from "../lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Page actions, for example the primary button. */
  actions?: React.ReactNode;
  className?: string;
};

/** The page's single h1, with optional description and actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">{title}</h1>
        {description ? <p className="text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
