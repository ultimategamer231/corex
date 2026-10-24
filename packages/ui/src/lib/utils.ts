import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom theme scales so `cn()` resolves conflicts correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "primary",
        "primary-dark",
        "primary-darker",
        "primary-foreground",
        "accent",
        "accent-hover",
        "accent-foreground",
        "tint",
        "ink",
        "ink-soft",
        "muted",
        "border",
        "border-subtle",
        "border-strong",
        "background",
        "surface",
        "surface-muted",
        "on-dark",
        "on-dark-muted",
        "accent-on-dark",
        "white",
        "warning",
        "warning-subtle",
        "notice",
        "notice-icon",
        "notice-subtle",
        "notice-border",
        "info",
        "info-subtle",
        "danger",
        "danger-subtle",
        "danger-foreground",
        "chart-1",
        "chart-2",
        "data-1",
        "data-2",
        "ring",
        "ring-on-dark",
      ],
      font: ["sans", "display", "mono"],
      shadow: ["pop", "preview"],
    },
  },
});

/** Merges class names, letting later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
