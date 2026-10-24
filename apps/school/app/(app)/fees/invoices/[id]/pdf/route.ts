import { renderInvoicePdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { letterhead, pdfResponse, toMoney } from "@/lib/pdf";
import { rows } from "@/lib/queries";
import { BURSAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

/** Invoice PDF with letterhead, number and generation time (CORE-10). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles([...BURSAR, "student", "parent"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const invoice = await supabase
    .from("invoices")
    .select("number, party_id, currency, status, issue_date, due_date, notes")
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!invoice?.number || invoice.status === "draft") notFound();
  const [lines, balance, student, settings] = await Promise.all([
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
      .from("students")
      .select("student_number, first_name, middle_name, last_name")
      .eq("id", invoice.party_id)
      .maybeSingle()
      .then(rows),
    getSettings(),
  ]);
  const c = invoice.currency;
  const total = balance?.total_minor ?? 0;
  const paid = balance?.paid_minor ?? 0;
  const pdf = await renderInvoicePdf({
    org: await letterhead(),
    timezone: settings.timezone,
    number: invoice.number,
    status: invoice.status as "issued" | "partially_paid" | "paid" | "void",
    issueDate: invoice.issue_date ?? new Date().toISOString(),
    dueDate: invoice.due_date,
    billTo: { name: student ? personName(student) : "Student", detail: student?.student_number },
    lines: lines.map((l) => ({
      description: l.description,
      quantity: String(Number(l.quantity)),
      unit: toMoney(l.unit_amount_minor, c),
      amount: toMoney(l.amount_minor, c),
    })),
    total: toMoney(total, c),
    paid: toMoney(paid, c),
    balance: toMoney(invoice.status === "void" ? 0 : total - paid, c),
    notes: invoice.notes,
    generatedAt: new Date(),
  });
  return pdfResponse(pdf, `INV-${String(invoice.number).padStart(6, "0")}.pdf`);
}
