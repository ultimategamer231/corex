"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { deleteDraft } from "@/app/(app)/invoices/actions";

/** Deletes a draft; the server returns to the list. Sent invoices are voided instead. */
export function DeleteDraft({ invoiceId }: { invoiceId: string }) {
  return (
    <ActionForm action={deleteDraft} aria-label="Delete draft">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Deleting...">
        Delete draft
      </SubmitButton>
    </ActionForm>
  );
}
