import { Badge } from "@corex/ui/components/badge";
import { Button, buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { formatDateTime } from "@corex/core/dates";
import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/section";
import { balances, patientNames } from "@/lib/bills";
import { dayBounds, PAYERS, shiftDay } from "@/lib/clinic";
import { date, money, personName, todayIso } from "@/lib/format";
import { INVOICE_STATUS, invoiceStatus } from "@/lib/invoices";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { BILLING } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

export const metadata: Metadata = { title: "Billing" };

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

const link = "inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline";

export default async function BillingPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(BILLING);
  const settings = await getSettings();
  const tz = settings.timezone;
  const params = await searchParams;
  const status = Object.keys(INVOICE_STATUS).find((s) => s === params.status);
  const page = pageFrom(params.page);

  let query = supabase
    .from("invoices")
    .select("id, number, party_id, currency, status, payer_type, payer_name, created_at", {
      count: "exact",
    })
    .eq("party_type", "patient")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const since = dayBounds(shiftDay(todayIso(tz), -7), tz).start;
  const [result, recent] = await Promise.all([
    query,
    supabase
      .from("encounters")
      .select(
        "id, opened_at, status, patients(id, patient_number, first_name, middle_name, last_name)",
      )
      .gte("opened_at", since)
      .order("opened_at", { ascending: false })
      .limit(100)
      .then(rows),
  ]);
  const bills = rows(result);
  const billed = recent.length
    ? rows(
        await supabase
          .from("invoices")
          .select("encounter_id")
          .in(
            "encounter_id",
            recent.map((e) => e.id),
          )
          .neq("status", "void"),
      )
    : [];
  const billedIds = new Set(billed.map((b) => b.encounter_id));
  const toBill = recent.filter((e) => !billedIds.has(e.id));
  const [names, totals] = await Promise.all([
    patientNames(
      supabase,
      bills.map((b) => b.party_id),
    ),
    balances(
      supabase,
      bills.map((b) => b.id),
    ),
  ]);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Bills for visits, payments and receipts."
        actions={
          <Link className={buttonVariants({ variant: "accent" })} href="/billing/new">
            New bill
          </Link>
        }
      />
      <div className="flex flex-col gap-10">
        <Section
          title="Visits to bill"
          id="to-bill"
          description="Visits in the last 7 days without a bill."
        >
          {toBill.length === 0 ? (
            <p className="text-muted">Every recent visit has a bill.</p>
          ) : (
            <TableScroll label="Visits to bill">
              <Table>
                <thead>
                  <tr>
                    <Th>Patient</Th>
                    <Th>Visit</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {toBill.map((e) => (
                    <tr key={e.id}>
                      <Td className="font-semibold">
                        {e.patients
                          ? `${personName(e.patients)} (${e.patients.patient_number})`
                          : ""}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatDateTime(e.opened_at, tz)}
                        {e.status === "open" ? (
                          <Badge variant="brand" className="ml-2">
                            Open
                          </Badge>
                        ) : null}
                      </Td>
                      <Td className="text-right">
                        <Link
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                          href={`/billing/new?patient=${e.patients?.id ?? ""}&encounter=${e.id}`}
                        >
                          Bill this visit
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>

        <Section title="Bills" id="bills">
          <form className="flex flex-wrap items-end gap-3" aria-label="Filter bills">
            <div className="flex w-48 flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={status ?? ""}>
                <option value="">All bills</option>
                {Object.entries(INVOICE_STATUS).map(([value, s]) => (
                  <option key={value} value={value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
          {bills.length === 0 ? (
            <EmptyState icon={<Receipt />} title="No bills" description="Bill a visit to start." />
          ) : (
            <>
              <TableScroll label="Bills">
                <Table>
                  <thead>
                    <tr>
                      <Th>Bill</Th>
                      <Th>Patient</Th>
                      <Th>Payer</Th>
                      <Th>Date</Th>
                      <Th className="text-right">Total</Th>
                      <Th className="text-right">Balance</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b) => {
                      const s = invoiceStatus(b.status);
                      const t = totals.get(b.id) ?? { total: 0, paid: 0 };
                      return (
                        <tr key={b.id}>
                          <Td>
                            <Link className={link} href={`/billing/${b.id}`}>
                              {b.number ? `No. ${b.number}` : "Draft"}
                            </Link>
                            <Badge variant={s.variant} className="ml-2">
                              {s.label}
                            </Badge>
                          </Td>
                          <Td>{names.get(b.party_id)}</Td>
                          <Td>
                            {PAYERS[b.payer_type as keyof typeof PAYERS] ?? b.payer_type}
                            {b.payer_name ? (
                              <p className="text-sm text-muted">{b.payer_name}</p>
                            ) : null}
                          </Td>
                          <Td className="whitespace-nowrap">{date(b.created_at, tz)}</Td>
                          <Td className="text-right whitespace-nowrap">
                            {money(t.total, b.currency)}
                          </Td>
                          <Td className="text-right whitespace-nowrap">
                            {money(b.status === "void" ? 0 : t.total - t.paid, b.currency)}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableScroll>
              <Pagination
                page={page}
                total={result.count ?? 0}
                hrefFor={(n) =>
                  `/billing?${new URLSearchParams({ ...(status ? { status } : {}), page: String(n) })}`
                }
              />
            </>
          )}
        </Section>
      </div>
    </>
  );
}
