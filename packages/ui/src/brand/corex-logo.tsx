import type * as React from "react";
import { cn } from "../lib/utils";

/**
 * The Corex circuit mark: a teal disc with three orange traces.
 * Vector version of the official logo (apps/web/public/brand/corex-logo.png).
 */
export function CorexMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cn("size-9 shrink-0", className)}
      {...props}
    >
      <circle cx="20" cy="20" r="20" fill="#0B6A67" />
      <g
        fill="none"
        stroke="#FF5A12"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 20h7l5-7h7" />
        <path d="M5 20h19" />
        <path d="M12 20l5 7h7" />
        <circle cx="27" cy="13" r="2.6" />
        <circle cx="27" cy="20" r="2.6" />
        <circle cx="27" cy="27" r="2.6" />
      </g>
    </svg>
  );
}

type CorexLogoProps = React.ComponentProps<"span"> & {
  /** `light` for light backgrounds, `dark` for dark panels such as the footer. */
  tone?: "light" | "dark";
  /** Show the "DIGITAL SOLUTIONS" line under the wordmark. */
  tagline?: boolean;
};

/**
 * Mark plus "CoreX" wordmark. When wrapped in a link, give the link a label that
 * contains the visible words, for example "Corex Digital Solutions home".
 */
export function CorexLogo({ tone = "light", tagline = true, className, ...props }: CorexLogoProps) {
  const dark = tone === "dark";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} {...props}>
      <CorexMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[22px] font-extrabold tracking-[-0.02em]",
            dark ? "text-white" : "text-primary",
          )}
        >
          Core<span className={dark ? "text-accent-on-dark" : "text-accent"}>X</span>
        </span>{" "}
        {tagline ? (
          <span
            className={cn(
              "mt-[3px] text-[9.5px] font-bold tracking-[0.16em]",
              dark ? "text-on-dark-muted" : "text-primary",
            )}
          >
            DIGITAL SOLUTIONS
          </span>
        ) : null}
      </span>
    </span>
  );
}
