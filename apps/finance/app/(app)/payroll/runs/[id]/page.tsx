import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { loadAccounts, loadCategories } from "@/lib/finance";
import { date, money, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { monthLabel, runStatus, totalsByCurrency } from "@/lib/payroll";
import { rows } from "@/lib/queries";
import { MANAGER, OWNER } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { approveRun, payRun, recalculateRun } from "../../actions";

export const metadata: Metadata = { title: "Payroll run" };

type Props = { params: Promise<{ id: string }> };

export default async function PayrollRunPage({ params }: Props) {
  const { supabase, member } = await requireRoles(MANAGER);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const owner = memberHas(member, OWNER);
  const settings = await getSettings();
  const run = await supabase
    .from("payroll_runs")
    .select("id, period_month, status, approved_at, paid_at")
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!run) notFound();
  const [slips, accounts, categories] = await Promise.all([
    supabase
      .from("payslips")
      .select(
        "id, currency, gross_minor, total_allowances_minor, total_deductions_minor, net_minor, employees(first_name, last_name, employee_number)",
      )
      .eq("payroll_run_id", id)
      .then(rows),
    loadAccounts(supabase),
    loadCategories(supabase),
  ]);
  slips.sort((a, b) =>
    (a.employees?.employee_number ?? "").localeCompare(b.employees?.employee_number ?? ""),
  );
  const s = runStatus(run.status);
  const totals = totalsByCurrency(slips);
  const currencies = totals.filter(([, v]) => v > 0).map(([c]) => c);
  const expense = categories.filter((c) => c.type === "expense" && c.active);
  const title = monthLabel(run.period_month);

  return (
    <>
      <PageHeader
        title={`Payroll: ${title}`}
        description={
          run.status === "paid"
            ? `Paid ${date(run.paid_at, settings.timezone)}`
            : run.status === "approved"
              ? `Approved ${date(run.approved_at, settings.timezone)}`
              : "Draft: recalculate after changing salaries or components."
        }
        actions={<Badge variant={s.variant}>{s.label}</Badge>}
      />
      <div className="flex flex-col gap-10">
        {run.status === "draft" ? null : (
          <Alert tone="info">
            Approved payslips are fixed: later changes to salaries or components do not change them.
          </Alert>
        )}
        <Section title="Payslips" id="payslips">
          {slips.length === 0 ? (
            <p className="text-muted">No active employees. Add employees first.</p>
          ) : (
            <TableScroll label="Payslips">
              <Table>
                <thead>
                  <tr>
                    <Th>Employee</Th>
                    <Th className="text-right">Gross</Th>
                    <Th className="text-right">Allowances</Th>
                    <Th className="text-right">Deductions</Th>
                    <Th className="text-right">Net pay</Th>
                    <Th>
                      <span className="sr-only">Payslip</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {slips.map((p) => {
                    const name = `${p.employees?.first_name ?? ""} ${p.employees?.last_name ?? ""}`;
                    return (
                      <tr key={p.id}>
                        <Td>
                          <span className="font-semibold">{name}</span>
                          <p className="text-sm text-muted">{p.employees?.employee_number}</p>
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          {money(p.gross_minor, p.currency)}
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          {money(p.total_allowances_minor, p.currency)}
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          {money(p.total_deductions_minor, p.currency)}
                        </Td>
                        <Td className="text-right font-semibold whitespace-nowrap">
                          {money(p.net_minor, p.currency)}
                        </Td>
                        <Td className="text-right">
                          <a
                            className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                            href={`/payroll/payslips/${p.id}/pdf`}
                          >
                            Payslip<span className="sr-only"> for {name}</span>
                          </a>
                        </Td>
                      </tr>
                    );
                  })}
                  {totals.map(([c, v]) => (
                    <tr key={c} className="font-bold">
                      <Td>Total net pay ({c})</Td>
                      <Td />
                      <Td />
                      <Td />
                      <Td className="text-right whitespace-nowrap">{money(v, c)}</Td>
                      <Td />
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>

        {run.status === "draft" ? (
          <div className="flex flex-wrap gap-3">
            <ActionForm
              action={recalculateRun}
              resetOnSuccess={false}
              aria-label="Recalculate payslips"
            >
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="month" value={run.period_month} />
              <SubmitButton variant="secondary" pendingLabel="Recalculating...">
                Recalculate
              </SubmitButton>
            </ActionForm>
            {owner ? (
              <ConfirmAction
                action={approveRun}
                fields={{ id, month: run.period_month }}
                triggerLabel="Approve payroll"
                triggerVariant="accent"
                title={`Approve payroll for ${title}?`}
                description="The payslips are recalculated now and then fixed. Approved payroll cannot be edited."
                confirmLabel="Approve payroll"
                variant="primary"
              />
            ) : (
              <p className="self-center text-muted">The Owner approves payroll.</p>
            )}
          </div>
        ) : null}

        {run.status === "approved" ? (
          owner ? (
            <Section
              title="Mark as paid"
              id="pay"
              description="Records the net pay as salary expenses, one entry per currency, from the accounts you choose."
            >
              <ActionForm
                action={payRun}
                resetOnSuccess={false}
                aria-label="Mark payroll as paid"
                className="max-w-2xl rounded-xl border border-border bg-background p-5"
              >
                <input type="hidden" name="id" value={id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField name="date" label="Payment date" required>
                    <Input type="date" defaultValue={todayIso(settings.timezone)} />
                  </FormField>
                  <FormField name="category_id" label="Expense category" required>
                    <Select defaultValue={expense.find((c) => c.name === "Salaries")?.id ?? ""}>
                      <option value="">Choose a category</option>
                      {expense.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  {currencies.map((c) => {
                    const options = accounts.filter((a) => a.active && a.currency === c);
                    return (
                      <FormField
                        key={c}
                        name={`account_${c}`}
                        label={`Pay ${c} salaries from`}
                        required
                      >
                        <Select defaultValue={options.length === 1 ? options[0]?.id : ""}>
                          <option value="">Choose a {c} account</option>
                          {options.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    );
                  })}
                  {currencies.some((c) => c !== settings.baseCurrency) ? (
                    <FormField
                      name="fx_rate"
                      label={`Rate to ${settings.baseCurrency}`}
                      hint="For salaries not in the base currency. Leave empty to use the latest rate in Settings."
                    >
                      <Input inputMode="decimal" />
                    </FormField>
                  ) : null}
                </div>
                <div>
                  <SubmitButton variant="accent" pendingLabel="Recording...">
                    Mark as paid
                  </SubmitButton>
                </div>
              </ActionForm>
            </Section>
          ) : (
            <p className="text-muted">The Owner marks payroll as paid.</p>
          )
        ) : null}
      </div>
    </>
  );
}
