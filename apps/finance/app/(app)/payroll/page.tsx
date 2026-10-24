import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { money, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { monthLabel, runStatus, totalsByCurrency } from "@/lib/payroll";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { prepareRun } from "./actions";

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollPage() {
  const { supabase } = await requireRoles(MANAGER);
  const settings = await getSettings();
  const runs = rows(
    await supabase
      .from("payroll_runs")
      .select("id, period_month, status, payslips(currency, net_minor)")
      .order("period_month", { ascending: false })
      .limit(24),
  );
  return (
    <>
      <PageHeader title="Payroll" description="Monthly runs: prepare, approve, then mark paid." />
      <div className="flex flex-col gap-10">
        {runs.length === 0 ? (
          <p className="text-muted">No payroll runs yet. Prepare the first month below.</p>
        ) : (
          <TableScroll label="Payroll runs">
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Payslips</Th>
                  <Th className="text-right">Net pay</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const s = runStatus(r.status);
                  return (
                    <tr key={r.id}>
                      <Td>
                        <Link
                          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                          href={`/payroll/runs/${r.id}`}
                        >
                          {monthLabel(r.period_month)}
                        </Link>
                      </Td>
                      <Td>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </Td>
                      <Td className="text-right">{r.payslips.length}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {totalsByCurrency(r.payslips)
                          .map(([c, v]) => money(v, c))
                          .join(" + ") || "-"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
        <Section
          title="Prepare a month"
          id="prepare"
          description="Calculates every active employee's payslip from their salary and pay components. A draft can be recalculated until it is approved."
        >
          <ActionForm
            action={prepareRun}
            resetOnSuccess={false}
            aria-label="Prepare a payroll month"
            className="flex max-w-xl flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-5"
          >
            <FormField name="month" label="Month" required className="w-52">
              <Input type="month" defaultValue={todayIso(settings.timezone).slice(0, 7)} />
            </FormField>
            <SubmitButton variant="accent" pendingLabel="Calculating...">
              Prepare payroll
            </SubmitButton>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
