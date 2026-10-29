"use client";

import { Button, type ButtonProps } from "@corex/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@corex/ui/components/dialog";
import { toast } from "@corex/ui/components/sonner";
import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { ActionForm, SubmitButton } from "./action-form";

/** A form in a dialog; it closes on success and the result is announced as a toast. */
export function FormDialog({
  action,
  triggerLabel,
  triggerVariant = "secondary",
  triggerIcon,
  title,
  description,
  submitLabel = "Save",
  children,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  triggerLabel: string;
  triggerVariant?: ButtonProps["variant"];
  triggerIcon?: React.ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          {triggerIcon}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="pr-10 text-xl font-bold">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="text-[15px] text-ink-soft">{description}</DialogDescription>
        ) : null}
        <ActionForm
          action={action}
          resetOnSuccess={false}
          aria-label={title}
          onSuccess={(state) => {
            setOpen(false);
            if (state.message) toast.success(state.message);
          }}
        >
          {children}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="primary">{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
