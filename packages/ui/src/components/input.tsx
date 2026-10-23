import type * as React from "react";
import { cn } from "../lib/utils";

/**
 * Text input. 16px text avoids zoom on iOS; the strong border meets the 3:1
 * non-text contrast rule. Set `aria-invalid` to show the error state.
 */
export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-border-strong bg-background text-ink min-h-11 w-full min-w-0 rounded-lg border px-3 py-2 text-base",
        "placeholder:text-muted transition-[border-color] duration-150",
        "focus-visible:border-primary disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
        "file:text-primary file:mr-3 file:border-0 file:bg-transparent file:font-semibold",
        className,
      )}
      {...props}
    />
  );
}
