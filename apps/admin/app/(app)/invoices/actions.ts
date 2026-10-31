"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, dbMessage, runAction } from "@/lib/action";
import { renderBillingPdf } from "@corex/pdf";
import { hashToken, randomToken } from "@/lib/auth/tokens";
import { sendEmail, simpleEmailHtml } from "@/lib/email";
import { adminEnv } from "@/lib/env";
import { uuid } from "@/lib/fields";
import { loadInvoiceDocument } from "@/lib/invoice-document-data";
import { logEvent } from "@/lib/log";
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

/** LINK-01: a new 30-day client view link; any older link stops working. */
export async function createLink(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: invoiceRef, revalidate: ["/invoices"] },
    async (data, session): Promise<FormState> => {
      const token = randomToken();
      fail(
        (
          await session.supabase.rpc("create_invoice_link", {
            p_invoice_id: data.invoiceId,
            p_token_hash: hashToken(token),
          })
        ).error,
      );
      return {
        status: "success",
        message: "New client view link created. Any older link no longer works.",
        data: { link: `${adminEnv().adminUrl}/i/${token}` },
      };
    },
  );
}

const emailSchema = z.object({
  invoiceId: uuid("an invoice"),
  to: z.email("Enter a valid email address"),
});

/**
 * SPEC-ADMIN.md 9.6: emails the invoice PDF and a fresh client view link. While
 * CLIENT_EMAIL_ENABLED is off the attempt is only recorded.
 */
export async function emailInvoice(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: emailSchema, revalidate: ["/invoices"] },
    async (data, session): Promise<FormState> => {
      if (process.env.CLIENT_EMAIL_ENABLED !== "true") {
        throw new ActionError(
          "Emails to clients are off until the sending domain is verified. Use Download or Copy for WhatsApp.",
        );
      }
      const loaded = await loadInvoiceDocument(session.supabase, data.invoiceId);
      if (!loaded || loaded.invoice.status === "draft" || loaded.invoice.status === "void") {
        throw new ActionError("Only a sent invoice can be emailed.");
      }
      const token = randomToken();
      fail(
        (
          await session.supabase.rpc("create_invoice_link", {
            p_invoice_id: data.invoiceId,
            p_token_hash: hashToken(token),
          })
        ).error,
      );
      const link = `${adminEnv().adminUrl}/i/${token}`;
      const { invoice, doc, billing } = loaded;
      const number = invoice.display_number ?? "";
      const amount = doc.grand.value;
      const pdf = await renderBillingPdf(doc);
      const service = session.service();
      const status = await sendEmail(service, {
        to: data.to,
        subject: `Invoice ${number} from ${billing.company.name}`,
        template: "invoice",
        entityType: "invoices",
        entityId: invoice.id,
        audience: "client",
        attachments: [{ filename: `${number}.pdf`, content: pdf }],
        text: `Hello,\n\nPlease find invoice ${number} for ${amount}, due ${doc.meta[1]?.value ?? ""}.\nView it online and download the PDF here (valid 30 days):\n${link}\n\n${billing.company.name}`,
        html: simpleEmailHtml(
          `Invoice ${number}`,
          [
            "Hello,",
            `Please find invoice ${number} for ${amount}, due ${doc.meta[1]?.value ?? ""}. The PDF is attached.`,
          ],
          { label: "View the invoice", url: link },
        ),
      });
      if (status !== "sent") throw new ActionError("The email could not be sent. Try again later.");
      await logEvent(service, {
        area: "invoices",
        action: "invoice_emailed",
        summary: `Emailed invoice ${number} to ${data.to}`,
        actorId: session.admin.userId,
        entityType: "invoices",
        entityId: invoice.id,
        context: session.context,
      });
      return { status: "success", message: `Invoice emailed to ${data.to}.` };
    },
  );
}
