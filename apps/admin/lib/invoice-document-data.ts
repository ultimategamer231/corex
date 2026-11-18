import { type BillingSettings, billingFrom } from "./billing-settings";
import { type BillTo, type InvoicePayment, invoiceDocument } from "./billing-document";
import { getInvoice } from "./invoices-data";
import type { AdminDb } from "./supabase";

/** The client's billing name and contact, for "To:" on invoices and receipts. */
export async function billToFor(db: AdminDb, clientId: string): Promise<BillTo> {
  const [{ data: client }, { data: contact }] = await Promise.all([
    db.from("clients").select("name, address, city, country").eq("id", clientId).maybeSingle(),
    db
      .from("client_contacts")
      .select("name, email")
      .eq("client_id", clientId)
      .order("is_billing", { ascending: false })
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const place = [client?.address, client?.city, client?.country].filter(Boolean).join(", ");
  return {
    name: client?.name ?? "Client",
    lines: [contact?.name, contact?.email, place].filter((l): l is string => Boolean(l)),
  };
}

export async function billingSettings(db: AdminDb): Promise<BillingSettings> {
  const { data } = await db.from("settings").select("org_name, config").maybeSingle();
  return billingFrom(data?.org_name ?? "Corex Digital Solutions", data?.config);
}

/** Everything the invoice page, its PDF and the client view link show. */
export async function loadInvoiceDocument(db: AdminDb, id: string) {
  const found = await getInvoice(db, id);
  if (!found) return null;
  const [billing, billTo, { data: paid }] = await Promise.all([
    billingSettings(db),
    billToFor(db, found.invoice.party_id),
    db
      .from("payments")
      .select("amount_minor, method, received_at, receipts (display_number)")
      .eq("invoice_id", id)
      .eq("status", "posted")
      .order("received_at"),
  ]);
  const payments: InvoicePayment[] = (
    (paid ?? []) as unknown as {
      amount_minor: number;
      method: string;
      received_at: string;
      receipts: { display_number: string | null } | { display_number: string | null }[] | null;
    }[]
  ).map((p) => {
    const receipt = Array.isArray(p.receipts) ? p.receipts[0] : p.receipts;
    return {
      receivedAt: p.received_at,
      method: p.method,
      receiptNumber: receipt?.display_number ?? null,
      amountMinor: p.amount_minor,
    };
  });
  return {
    ...found,
    billing,
    doc: invoiceDocument(found.invoice, found.lines, billing, billTo, new Date(), payments),
  };
}
