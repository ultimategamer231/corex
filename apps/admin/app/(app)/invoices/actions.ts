"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, dbMessage, runAction } from "@/lib/action";
import { uuid } from "@/lib/fields";
import type { FormState } from "@/lib/form-state";
import { draftPayload, draftSchema, paymentSchema, voidSchema } from "@/lib/invoices";

const BILLING = ["/invoices", "/clients"];

function fail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (/invoices_one_milestone/.test(error.message)) {
    throw new ActionError("This milestone already has an invoice. Void it first to replace it.");
  }
  if (/invoices_one_renewal/.test(error.message)) {
    throw new ActionError("This renewal period already has an invoice.");
  }
  throw new ActionError(dbMessage(error));
}

/** Creates or updates a draft with its lines and totals, in one transaction. */
export async function saveDraft(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: draftSchema, revalidate: BILLING },
    async (data, session): Promise<FormState> => {
      const { data: id, error } = await session.supabase.rpc("save_invoice_draft", {
        // null creates a new draft; the generated type does not show that.
        p_invoice_id: data.invoiceId as string,
        p: draftPayload(data) as never,
      });
      fail(error);
      return { status: "success", message: "Draft saved.", data: { invoiceId: String(id) } };
    },
  );
}

const invoiceRef = z.object({ invoiceId: uuid("an invoice") });

/** INV-05: sends a draft; it gets its number and due date now. */
export async function sendInvoice(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: invoiceRef, revalidate: BILLING }, async (data, session) => {
    fail((await session.supabase.rpc("issue_invoice", { p_invoice_id: data.invoiceId })).error);
    const { data: row } = await session.supabase
      .from("invoices")
      .select("display_number")
      .eq("id", data.invoiceId)
      .single();
    return `Invoice ${row?.display_number ?? ""} is ready to send to the client.`;
  });
}

/** Deletes a draft and goes to the list (its own page no longer exists). */
export async function deleteDraft(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: invoiceRef }, async (data, session): Promise<FormState> => {
    fail(
      (await session.supabase.rpc("delete_invoice_draft", { p_invoice_id: data.invoiceId })).error,
    );
    for (const path of BILLING) revalidatePath(path, "layout");
    redirect("/invoices");
  });
}

/** INV-06: voided with a reason; it stays visible, struck through. */
export async function voidInvoice(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: voidSchema, revalidate: BILLING }, async (data, session) => {
    fail(
      (
        await session.supabase.rpc("void_invoice", {
          p_invoice_id: data.id,
          p_reason: data.reason,
        })
      ).error,
    );
    return "Invoice voided.";
  });
}

/** PAY-01 to PAY-03: the payment and its receipt, in one transaction. */
export async function recordPayment(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: paymentSchema, revalidate: BILLING },
    async (data, session) => {
      const amount = Number(data.amountMinor);
      if (!Number.isSafeInteger(amount)) throw new ActionError("This amount is too large.");
      const { data: rows, error } = await session.supabase.rpc("record_payment", {
        p_payment_id: data.paymentId,
        p_invoice_id: data.invoiceId,
        p_amount_minor: amount,
        p_currency: data.currency,
        p_method: data.method,
        p_reference: data.reference ?? undefined,
        p_received_at: `${data.receivedOn}T12:00:00Z`,
      });
      fail(error);
      const receiptId = (rows as { receipt_id: string }[] | null)?.[0]?.receipt_id;
      const { data: receipt } = receiptId
        ? await session.supabase
            .from("receipts")
            .select("display_number")
            .eq("id", receiptId)
            .single()
        : { data: null };
      return `Payment recorded. Receipt ${receipt?.display_number ?? ""} issued.`;
    },
  );
}

/** PAY-05: the payment and its receipt are voided; the balance goes back up. */
export async function voidPayment(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: voidSchema, revalidate: BILLING }, async (data, session) => {
    fail(
      (
        await session.supabase.rpc("void_payment", {
          p_payment_id: data.id,
          p_reason: data.reason,
        })
      ).error,
    );
    return "Payment voided. Its receipt is void too.";
  });
}
