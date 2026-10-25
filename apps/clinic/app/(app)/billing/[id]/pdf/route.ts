import { renderInvoicePdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import { PAYERS } from "@/lib/clinic";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { letterhead, pdfResponse, toMoney } from "@/lib/pdf";
import { rows } from "@/lib/queries";
import { BILLING } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

/** Bill PDF with letterhead, number and generation time (CORE-10). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles(BILLING);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const bill = await supabase
    .from("invoices")
    .select(
      "number, party_id, currency, status, issue_date, due_date, notes, payer_type, payer_name",
    )
    .eq("id", id)
    .eq("party_type", "patient")
    .maybeSingle()
    .then(rows);
  if (!bill?.number || bill.status === "draft") notFound();
  const [lines, balance, patient, settings] = await Promise.all([
    supabase
      .from("invoice_lines")
      .select("description, quantity, unit_amount_minor, amount_minor")
      .eq("invoice_id", id)
      .order("created_at")
      .then(rows),
    supabase
      .from("invoice_balances")
      .select("total_minor, paid_minor")
      .eq("invoice_id", id)
      .maybeSingle()
      .then(rows),
    supabase
      .from("patients")
      .select("first_name, middle_name, last_name, patient_number")
      .eq("id", bill.party_id)
      .maybeSingle()
      .then(rows),
    getSettings(),
  ]);
  const c = bill.currency;
  const total = Number(balance?.total_minor ?? 0);
  const paid = Number(balance?.paid_minor ?? 0);
  const payer =
    bill.payer_type === "self"
      ? undefined
      : `${PAYERS[bill.payer_type as keyof typeof PAYERS] ?? "Payer"}: ${bill.payer_name ?? ""}`;
  const pdf = await renderInvoicePdf({
    org: await letterhead(),
    timezone: settings.timezone,
    number: bill.number,
    status: bill.status as "issued" | "partially_paid" | "paid" | "void",
    issueDate: bill.issue_date ?? new Date().toISOString(),
    dueDate: bill.due_date,
    billTo: {
      name: patient ? personName(patient) : "Patient",
      detail: [patient?.patient_number, payer].filter(Boolean).join(", ") || undefined,
    },
    lines: lines.map((l) => ({
      description: l.description,
      quantity: String(Number(l.quantity)),
      unit: toMoney(l.unit_amount_minor, c),
      amount: toMoney(l.amount_minor, c),
    })),
    total: toMoney(total, c),
    paid: toMoney(paid, c),
    balance: toMoney(bill.status === "void" ? 0 : total - paid, c),
    notes: bill.notes,
    generatedAt: new Date(),
  });
  return pdfResponse(pdf, `BILL-${String(bill.number).padStart(6, "0")}.pdf`);
}
