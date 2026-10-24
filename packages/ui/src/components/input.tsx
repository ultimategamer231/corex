"use client";

import type * as React from "react";
import { cn } from "../lib/utils";
import { useFieldControlProps } from "./field";

/**
 * Text input. 16px text avoids zoom on iOS; the strong border meets the 3:1
 * non-text contrast rule. Set `aria-invalid` to show the error state.
 */
export function Input(all: React.ComponentProps<"input">) {
  const { className, type = "text", ...props } = useFieldControlProps(all);
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-11 w-full min-w-0 rounded-lg border border-border-strong bg-background px-3 py-2 text-base text-ink",
        "transition-[border-color] duration-150 placeholder:text-muted",
        "focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
        "file:mr-3 file:border-0 file:bg-transparent file:font-semibold file:text-primary",
        className,
      )}
      {...props}
    />
  );
}
