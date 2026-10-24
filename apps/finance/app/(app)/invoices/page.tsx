import { Badge } from "@corex/ui/components/badge";
import { Button, buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { loadCounterparties } from "@/lib/finance";
import { date, money } from "@/lib/format";
import { INVOICE_STATUS, invoiceStatus, type InvoiceStatus } from "@/lib/invoices";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices" };

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

export default async function InvoicesPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(MANAGER);
  const settings = await getSettings();
  const params = await searchParams;
  const status = (Object.keys(INVOICE_STATUS) as InvoiceStatus[]).find((s) => s === params.status);
  const page = pageFrom(params.page);
  let query = supabase
    .from("invoices")
    .select("id, number, party_id, currency, status, issue_date, due_date", { count: "exact" })
    .order("number", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const [result, counterparties] = await Promise.all([query, loadCounterparties(supabase)]);
  const invoices = rows(result);
  const balances = invoices.length
    ? rows(
        await supabase
          .from("invoice_balances")
          .select("invoice_id, total_minor, paid_minor")
          .in(
            "invoice_id",
            invoices.map((i) => i.id),
          ),
      )
    : [];
  const byId = new Map(balances.map((b) => [b.invoice_id, b]));
  const names = new Map(counterparties.map((c) => [c.id, c.name]));
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Sales invoices to your customers."
        actions={
          <Link className={buttonVariants({ variant: "accent" })} href="/invoices/new">
            New invoice
          </Link>
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-3" aria-label="Filter invoices">
        <div className="flex w-48 flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
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
      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No invoices"
          description="Create an invoice for a customer to start."
        />
      ) : (
        <>
          <TableScroll label="Invoices">
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const b = byId.get(i.id);
                  const total = Number(b?.total_minor ?? 0);
                  const s = invoiceStatus(i.status);
                  return (
                    <tr key={i.id}>
                      <Td>
                        <Link
                          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                          href={`/invoices/${i.id}`}
                        >
                          {i.number ? `No. ${i.number}` : "Draft"}
                        </Link>
                      </Td>
                      <Td>{names.get(i.party_id)}</Td>
                      <Td className="whitespace-nowrap">{date(i.due_date, settings.timezone)}</Td>
                      <Td className="text-right whitespace-nowrap">{money(total, i.currency)}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {i.status === "void"
                          ? "-"
                          : money(total - Number(b?.paid_minor ?? 0), i.currency)}
                      </Td>
                      <Td>
                        <Badge variant={s.variant}>{s.label}</Badge>
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
            hrefFor={(p) =>
              `/invoices?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) }).toString()}`
            }
          />
        </>
      )}
    </>
  );
}
