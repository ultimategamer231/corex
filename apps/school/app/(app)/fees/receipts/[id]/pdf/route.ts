import { renderReceiptPdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { letterhead, pdfResponse, toMoney } from "@/lib/pdf";
import { rows } from "@/lib/queries";
import { BURSAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

const METHODS = ["cash", "mobile_money", "bank", "other"] as const;

/** Receipt PDF; a voided payment's receipt stays printable, marked void (CORE-07). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles([...BURSAR, "student"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const receipt = await supabase
    .from("receipts")
    .select(
      "number, payments(id, invoice_id, amount_minor, currency, method, reference, received_at, status, void_reason)",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  const payment = receipt?.payments;
  if (!receipt || !payment) notFound();
  const [invoice, balance, earlier, settings] = await Promise.all([
    supabase
      .from("invoices")
      .select("number, party_id")
      .eq("id", payment.invoice_id)
      .maybeSingle()
      .then(rows),
    supabase
      .from("invoice_balances")
      .select("total_minor")
      .eq("invoice_id", payment.invoice_id)
      .maybeSingle()
      .then(rows),
    supabase
      .from("payments")
      .select("amount_minor")
      .eq("invoice_id", payment.invoice_id)
      .eq("status", "posted")
      .lte("received_at", payment.received_at)
      .then(rows),
    getSettings(),
  ]);
  if (!invoice?.number) notFound();
  const student = await supabase
    .from("students")
    .select("first_name, middle_name, last_name")
    .eq("id", invoice.party_id)
    .maybeSingle()
    .then(rows);
  const paidSoFar = earlier.reduce((sum, p) => sum + p.amount_minor, 0);
  const method = METHODS.find((m) => m === payment.method) ?? "other";
  const pdf = await renderReceiptPdf({
    org: await letterhead(),
    timezone: settings.timezone,
    number: receipt.number,
    invoiceNumber: invoice.number,
    receivedFrom: student ? personName(student) : "Student",
    amount: toMoney(payment.amount_minor, payment.currency),
    method,
    reference: payment.reference,
    receivedAt: payment.received_at,
    balanceAfter: toMoney(Math.max(0, (balance?.total_minor ?? 0) - paidSoFar), payment.currency),
    voidReason: payment.status === "void" ? (payment.void_reason ?? "Voided") : null,
    generatedAt: new Date(),
  });
  return pdfResponse(pdf, `RCT-${String(receipt.number).padStart(6, "0")}.pdf`);
}
