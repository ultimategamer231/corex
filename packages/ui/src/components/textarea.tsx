"use client";

import type * as React from "react";
import { cn } from "../lib/utils";
import { useFieldControlProps } from "./field";

export function Textarea(all: React.ComponentProps<"textarea">) {
  const { className, rows = 4, ...props } = useFieldControlProps(all);
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        "w-full min-w-0 rounded-lg border border-border-strong bg-background px-3 py-2 text-base text-ink",
        "placeholder:text-muted focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
