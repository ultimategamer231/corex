import { Button, buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { DEMO_EXPORT_ROWS, demoInstance } from "@/lib/demo";
import { loadAccounts } from "@/lib/finance";
import { todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { formatCell } from "@/lib/report-format";
import {
  buildReport,
  readReportRequest,
  type ReportParams,
  reportQuery,
} from "@/lib/report-request";
import { REPORTS } from "@/lib/reports";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

type Props = { searchParams: Promise<ReportParams> };

export default async function ReportsPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(MANAGER);
  const settings = await getSettings();
  const request = readReportRequest(await searchParams, todayIso(settings.timezone));
  const [accounts, table] = await Promise.all([
    loadAccounts(supabase),
    buildReport(supabase, request, settings.baseCurrency),
  ]);
  const query = reportQuery(request).toString();
  // The demo exports at most 200 rows (SPEC.md 11.3).
  const exportable = !demoInstance() || (table?.rows.length ?? 0) <= DEMO_EXPORT_ROWS;
  return (
    <>
      <PageHeader
        title="Reports"
        description="Cash basis: money in and out when it was received or paid."
      />
      <form className="mb-6 flex flex-wrap items-end gap-3" aria-label="Choose a report">
        <div className="flex w-72 max-w-full flex-col gap-1.5">
          <Label htmlFor="report">Report</Label>
          <Select id="report" name="report" defaultValue={request.kind}>
            {Object.entries(REPORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-60 max-w-full flex-col gap-1.5">
          <Label htmlFor="account">Account (for statements)</Label>
          <Select id="account" name="account" defaultValue={request.account ?? ""}>
            <option value="">Choose an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={request.period.from} />
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={request.period.to} />
        </div>
        <Button type="submit" variant="secondary">
          Show report
        </Button>
      </form>

      {!table ? (
        <p className="text-muted">Choose an account to see its statement.</p>
      ) : (
        <section aria-labelledby="report-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="report-title" className="text-xl font-bold">
                {table.title}
              </h2>
              <p className="text-[15px] text-muted">{table.subtitle}</p>
            </div>
            {exportable ? (
              <div className="flex flex-wrap gap-2">
                <a
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`/reports/export?format=pdf&${query}`}
                >
                  Download PDF
                </a>
                <a
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`/reports/export?format=xlsx&${query}`}
                >
                  Download Excel
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Demo exports are limited to {DEMO_EXPORT_ROWS} rows. Choose a shorter period.
              </p>
            )}
          </div>
          {table.rows.length === 0 ? (
            <p className="text-muted">Nothing in this period.</p>
          ) : (
            <TableScroll label={table.title}>
              <Table>
                <thead>
                  <tr>
                    {table.columns.map((c) => (
                      <Th key={c.label} className={c.numeric ? "text-right" : undefined}>
                        {c.label}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, i) => (
                        <Td
                          key={i}
                          className={
                            table.columns[i]?.numeric
                              ? "text-right whitespace-nowrap"
                              : i === 0
                                ? "whitespace-nowrap"
                                : undefined
                          }
                        >
                          {formatCell(cell)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                  {table.total ? (
                    <tr className="font-bold">
                      {table.total.map((cell, i) => (
                        <Td
                          key={i}
                          className={
                            table.columns[i]?.numeric
                              ? "text-right whitespace-nowrap"
                              : i === 0
                                ? "whitespace-nowrap"
                                : undefined
                          }
                        >
                          {formatCell(cell)}
                        </Td>
                      ))}
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </section>
      )}
    </>
  );
}
