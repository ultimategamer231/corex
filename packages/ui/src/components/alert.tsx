import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/utils";

const alertVariants = cva("rounded-lg px-4 py-3 text-[15px] font-medium", {
  variants: {
    tone: {
      info: "bg-info-subtle text-info",
      success: "bg-tint text-primary-dark",
      warning: "bg-warning-subtle text-warning",
      danger: "bg-danger-subtle text-danger",
    },
  },
  defaultVariants: { tone: "info" },
});

/** Inline message. Errors are announced immediately (role="alert"), others politely. */
export function Alert({
  tone,
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}
