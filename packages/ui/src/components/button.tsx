import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "../lib/utils";

/**
 * Buttons. `accent` (orange) is reserved for the single primary call to action
 * on a screen (SPEC.md 5.4). Every size keeps a 44px minimum touch target.
 */
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-bold whitespace-nowrap",
    "transition-[background-color,border-color,color,transform] duration-150 ease-out",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  ],
  {
    variants: {
      variant: {
        accent: "bg-accent text-accent-foreground hover:bg-accent-hover",
        primary: "bg-primary text-primary-foreground hover:bg-primary-dark",
        outline:
          "border-[1.5px] border-primary bg-background text-primary hover:bg-tint hover:text-primary-dark",
        secondary:
          "border-[1.5px] border-border bg-background text-primary hover:border-primary hover:bg-surface",
        ghost: "text-ink hover:bg-surface-muted",
        link: "text-primary underline-offset-4 hover:underline",
        danger: "bg-danger text-danger-foreground hover:bg-danger/90",
      },
      size: {
        sm: "min-h-11 px-3.5 text-sm",
        md: "min-h-11 px-[18px] text-[15px]",
        lg: "min-h-13 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (for example a link) with button styles. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      // Native buttons default to "submit"; require forms to opt in explicitly.
      type={asChild ? type : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
