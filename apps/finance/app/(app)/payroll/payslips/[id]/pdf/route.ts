import { renderPayslipPdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { monthLabel } from "@/lib/payroll";
import { letterhead, pdfResponse, toMoney } from "@/lib/pdf";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

const PAID_BY = { bank: "bank transfer", mobile_money: "mobile money", cash: "cash" } as const;

/** A payslip from the lines saved with the run (FIN-06); drafts are not printed. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles(MANAGER);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const slip = await supabase
    .from("payslips")
    .select(
      "id, currency, gross_minor, total_deductions_minor, net_minor, payroll_runs(period_month, status), employees(first_name, last_name, employee_number, position, payment_method, bank_or_wallet_ref)",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  const run = slip?.payroll_runs;
  const employee = slip?.employees;
  if (!slip || !run || !employee || run.status === "draft") notFound();
  const [lines, settings] = await Promise.all([
    supabase
      .from("payslip_lines")
      .select("name, kind, amount_minor")
      .eq("payslip_id", id)
      .then(rows),
    getSettings(),
  ]);
  const order = { base: 0, allowance: 1, deduction: 2 } as const;
  const c = slip.currency;
  const pdf = await renderPayslipPdf({
    org: await letterhead(),
    timezone: settings.timezone,
    period: monthLabel(run.period_month),
    employee: {
      name: `${employee.first_name} ${employee.last_name}`,
      number: employee.employee_number,
      position: employee.position,
      paymentMethod:
        PAID_BY[employee.payment_method as keyof typeof PAID_BY] ?? employee.payment_method,
      reference: employee.bank_or_wallet_ref,
    },
    lines: lines
      .map((l) => ({ ...l, kind: l.kind as keyof typeof order }))
      .sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
      .map((l) => ({ name: l.name, kind: l.kind, amount: toMoney(l.amount_minor, c) })),
    gross: toMoney(slip.gross_minor, c),
    deductions: toMoney(slip.total_deductions_minor, c),
    net: toMoney(slip.net_minor, c),
    status: run.status === "paid" ? "paid" : "approved",
    generatedAt: new Date(),
  });
  return pdfResponse(
    pdf,
    `payslip-${employee.employee_number}-${run.period_month.slice(0, 7)}.pdf`,
  );
}
