import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-ink-soft",
        brand: "bg-tint text-primary-dark",
        warning: "bg-warning-subtle text-warning",
        info: "bg-info-subtle text-info",
        danger: "bg-danger-subtle text-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
