import type * as React from "react";

/** A titled page section (h2) with spacing. */
export function Section({
  title,
  id,
  description,
  actions,
  children,
}: {
  title: string;
  id: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="text-xl font-bold">
            {title}
          </h2>
          {description ? <div className="text-[15px] text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
