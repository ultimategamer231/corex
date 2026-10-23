"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export { toast } from "sonner";

/** Toast host. Place once in the root layout. Toasts are for transient messages only. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-background !text-ink !shadow-pop !font-sans",
          description: "!text-muted",
          actionButton: "!bg-primary !text-primary-foreground",
        },
      }}
      {...props}
    />
  );
}
