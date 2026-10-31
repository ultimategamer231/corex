import { receiptDocument } from "./billing-document";
import { billingSettings, billToFor } from "./invoice-document-data";
import type { AdminDb } from "./supabase";

/** A receipt as printed: its payment, the invoice, and the balance right after it. */
export async function loadReceiptDocument(db: AdminDb, receiptId: string) {
  const { data: receipt } = await db
    .from("receipts")
    .select(
      "id, number, display_number, issued_at, voided_at, payments!inner (id, invoice_id, amount_minor, currency, method, reference, received_at, status)",
    )
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return null;
  const payment = (
    receipt as unknown as {
      payments: {
        invoice_id: string;
        amount_minor: number;
        currency: string;
        method: string;
        reference: string | null;
        received_at: string;
        status: string;
      };
    }
  ).payments;
  const [{ data: invoice }, { data: earlier }] = await Promise.all([
    db
      .from("invoices")
      .select("id, display_number, total_minor, party_id")
      .eq("id", payment.invoice_id)
      .single(),
    db
      .from("receipts")
      .select("number, payments!inner (amount_minor, status, invoice_id)")
      .eq("payments.invoice_id", payment.invoice_id)
      .lte("number", receipt.number),
  ]);
  if (!invoice) return null;
  const paidSoFar = (
    (earlier ?? []) as unknown as { payments: { amount_minor: number; status: string } }[]
  )
    .filter((r) => r.payments.status === "posted")
    .reduce((sum, r) => sum + r.payments.amount_minor, 0);
  const [billing, billTo] = await Promise.all([
    billingSettings(db),
    billToFor(db, invoice.party_id),
  ]);
  return {
    number: receipt.display_number,
    doc: receiptDocument(
      {
        number: receipt.display_number,
        issuedAt: receipt.issued_at,
        voided: payment.status === "void" || receipt.voided_at !== null,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        method: payment.method,
        reference: payment.reference,
        receivedAt: payment.received_at,
        invoiceNumber: invoice.display_number,
        invoiceTotalMinor: invoice.total_minor,
        balanceAfterMinor: invoice.total_minor - paidSoFar,
      },
      billing,
      billTo,
    ),
  };
}
