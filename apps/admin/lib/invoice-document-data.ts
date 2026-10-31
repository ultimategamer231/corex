import { type BillingSettings, billingFrom } from "./billing-settings";
import { type BillTo, invoiceDocument } from "./billing-document";
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
  const [billing, billTo] = await Promise.all([
    billingSettings(db),
    billToFor(db, found.invoice.party_id),
  ]);
  return {
    ...found,
    billing,
    doc: invoiceDocument(found.invoice, found.lines, billing, billTo),
  };
}
