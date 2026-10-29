"use client";

import { Button, type ButtonProps } from "@corex/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@corex/ui/components/dialog";
import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { ActionForm, SubmitButton } from "./action-form";
import { CopyLink } from "./copy-link";

/**
 * A confirmed team action that returns a one-time link (invite, reset, authenticator
 * set-up). The link is shown once, to copy and pass on.
 */
export function LinkAction({
  action,
  fields,
  triggerLabel,
  title,
  description,
  confirmLabel,
  variant = "primary",
  triggerVariant = "secondary",
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: ButtonProps["variant"];
  triggerVariant?: ButtonProps["variant"];
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<FormState | null>(null);
  const link = result?.data?.link;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 text-xl font-bold">{title}</DialogTitle>
        <DialogDescription className="text-[15px] text-ink-soft">
          {link ? result?.message : description}
        </DialogDescription>
        {link ? (
          <div className="flex flex-col gap-4">
            <CopyLink link={link} />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <ActionForm action={action} onSuccess={setResult}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant={variant} pendingLabel="Working...">
                {confirmLabel}
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
