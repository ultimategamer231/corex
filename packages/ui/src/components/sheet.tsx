"use client";

import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "../lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

type Side = "top" | "right" | "bottom" | "left";

const sideClasses: Record<Side, string> = {
  top: "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
  right:
    "inset-y-0 right-0 h-full w-[min(20rem,85vw)] border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  left: "inset-y-0 left-0 h-full w-[min(20rem,85vw)] border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
};

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: Side }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className={cn(
          "bg-ink/50 fixed inset-0 z-50",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        )}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "border-border bg-background shadow-pop fixed z-50 flex flex-col gap-4 overflow-y-auto p-6",
          "data-[state=closed]:animate-out data-[state=open]:animate-in duration-200",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="text-muted hover:bg-surface-muted hover:text-ink absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-lg"
          aria-label="Close"
        >
          <XIcon className="size-5" aria-hidden="true" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("font-display text-ink pr-10 text-lg font-bold", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-muted text-sm", className)} {...props} />;
}
