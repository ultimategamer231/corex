import { cn } from "@corex/ui/lib/utils";

/**
 * Horizontally scrollable table container. Focusable so keyboard users can scroll
 * it (WCAG 2.1.1, axe scrollable-region-focusable), labelled by the section title.
 */
export function TableScroll({
  labelledBy,
  className,
  children,
}: {
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("overflow-x-auto rounded-2xl border border-border", className)}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard focusable
      tabIndex={0}
      role="region"
      aria-labelledby={labelledBy}
    >
      {children}
    </div>
  );
}
