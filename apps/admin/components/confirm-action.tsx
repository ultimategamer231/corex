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
import { Textarea } from "@corex/ui/components/textarea";
import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { ActionForm, FormField, SubmitButton } from "./action-form";

/**
 * Confirmation dialog for void, lock, reopen and similar actions (SPEC.md 5.4).
 * With `reasonLabel`, a reason is required and sent as `reason`.
 */
export function ConfirmAction({
  action,
  fields,
  triggerLabel,
  title,
  description,
  confirmLabel,
  reasonLabel,
  reasonRequired = true,
  variant = "danger",
  triggerVariant = "secondary",
  triggerSize = "sm",
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  variant?: ButtonProps["variant"];
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 text-xl font-bold">{title}</DialogTitle>
        <DialogDescription className="text-[15px] text-ink-soft">{description}</DialogDescription>
        <ActionForm
          action={action}
          onSuccess={(state) => {
            setOpen(false);
            // The dialog closes, so its result is announced as a toast.
            if (state.message) toast.success(state.message);
          }}
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {reasonLabel ? (
            <FormField name="reason" label={reasonLabel} required={reasonRequired}>
              <Textarea rows={3} />
            </FormField>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant={variant} pendingLabel="Working...">
              {confirmLabel}
            </SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
