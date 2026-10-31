import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination } from "@corex/ui/components/pagination";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { cn } from "@corex/ui/lib/utils";
import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { money } from "@/lib/clients";
import { formatDay } from "@/lib/format";
import {
  fetchInvoices,
  fetchReceipts,
  outstandingTotals,
  STATUS_FILTERS,
  type StatusFilter,
} from "@/lib/invoices-data";
import { methodLabel } from "@/lib/invoices";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices and receipts" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

const tabClass = (active: boolean) =>
  cn(
    "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 font-semibold whitespace-nowrap",
    active ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-primary",
  );

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = one(params.tab) === "receipts" ? "receipts" : "invoices";
  const status = (STATUS_FILTERS.find(([k]) => k === one(params.status))?.[0] ??
    "all") as StatusFilter;
  const page = Math.max(1, Number(one(params.page)) || 1);
  const range = { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE };
  const { supabase } = await getAdminSession();
  const totals = await outstandingTotals(supabase);
  const href = (p: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({
      tab: tab === "receipts" ? "receipts" : undefined,
      ...p,
    })) {
      if (v !== undefined && v !== "" && v !== "all") q.set(k, String(v));
    }
    const s = q.toString();
    return `/invoices${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices and receipts"
        description="Milestone, renewal and custom invoices, and the receipts for every payment."
        actions={
          <Link href="/invoices/new" className={buttonVariants({ variant: "accent" })}>
            <Plus aria-hidden="true" />
            New invoice
          </Link>
        }
      />

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
          <dt className="text-sm font-semibold text-muted">Outstanding</dt>
          <dd className="font-display text-2xl font-bold text-ink">
            {Object.keys(totals).length === 0
              ? "—"
              : Object.entries(totals)
                  .map(([c, t]) => money(t.outstanding, c))
                  .join(" · ")}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
          <dt className="text-sm font-semibold text-muted">Overdue</dt>
          <dd className="font-display text-2xl font-bold text-ink">
            {Object.values(totals).every((t) => t.overdue === 0)
              ? "—"
              : Object.entries(totals)
                  .filter(([, t]) => t.overdue > 0)
                  .map(([c, t]) => money(t.overdue, c))
                  .join(" · ")}
          </dd>
        </div>
      </dl>

      <nav aria-label="Invoices or receipts" className="overflow-x-auto">
        <ul className="flex gap-1 border-b border-border">
          <li>
            <Link
              href="/invoices"
              aria-current={tab === "invoices" ? "page" : undefined}
              className={tabClass(tab === "invoices")}
            >
              Invoices
            </Link>
          </li>
          <li>
            <Link
              href="/invoices?tab=receipts"
              aria-current={tab === "receipts" ? "page" : undefined}
              className={tabClass(tab === "receipts")}
            >
              Receipts
            </Link>
          </li>
        </ul>
      </nav>

      {tab === "invoices" ? (
        <InvoiceList status={status} page={page} range={range} href={href} />
      ) : (
        <ReceiptList page={page} range={range} href={href} />
      )}
    </div>
  );
}

async function InvoiceList({
  status,
  page,
  range,
  href,
}: {
  status: StatusFilter;
  page: number;
  range: { offset: number; limit: number };
  href: (p: Record<string, string | number | undefined>) => string;
}) {
  const { supabase } = await getAdminSession();
  const { rows, total } = await fetchInvoices(supabase, { status }, range);
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Invoice status">
        <ul className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([key, label]) => (
            <li key={key}>
              <Link
                href={href({ status: key })}
                aria-current={key === status ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 min-w-11 items-center rounded-full border px-4 text-sm font-semibold",
                  key === status
                    ? "border-primary bg-tint text-primary-dark"
                    : "border-border text-ink-soft hover:border-primary",
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No invoices here"
          description="Create invoices from a client's payment milestones, or a custom invoice."
        />
      ) : (
        <>
          <ul aria-label="Invoices" className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/invoices/${r.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4 hover:border-primary"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "font-semibold text-ink",
                        r.status === "void" && "line-through",
                      )}
                    >
                      {r.display_number ?? "Draft"}
                    </span>
                    <InvoiceStatusBadge status={r.shownStatus} />
                  </span>
                  <span className="text-sm text-ink-soft">{r.clientName}</span>
                  <span className="flex justify-between text-sm">
                    <span>{money(r.total_minor, r.currency)}</span>
                    <span className="text-ink-soft">
                      {r.due_date ? `Due ${formatDay(r.due_date)}` : "Not sent"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <TableScroll label="Invoices">
              <Table>
                <thead>
                  <tr>
                    <Th>Number</Th>
                    <Th>Client</Th>
                    <Th>Issued</Th>
                    <Th>Due</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Balance</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <Td>
                        <Link
                          href={`/invoices/${r.id}`}
                          className={cn(
                            "inline-flex min-h-11 min-w-11 items-center font-semibold text-ink hover:text-primary",
                            r.status === "void" && "line-through",
                          )}
                        >
                          {r.display_number ?? "Draft"}
                        </Link>
                      </Td>
                      <Td>{r.clientName}</Td>
                      <Td className="whitespace-nowrap">{formatDay(r.issue_date)}</Td>
                      <Td className="whitespace-nowrap">{formatDay(r.due_date)}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {money(r.total_minor, r.currency)}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        {r.status === "draft" || r.status === "void"
                          ? "—"
                          : money(r.balanceMinor, r.currency)}
                      </Td>
                      <Td>
                        <InvoiceStatusBadge status={r.shownStatus} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          </div>
        </>
      )}
      <Pagination page={page} total={total} hrefFor={(p) => href({ status, page: p })} />
    </div>
  );
}

async function ReceiptList({
  page,
  range,
  href,
}: {
  page: number;
  range: { offset: number; limit: number };
  href: (p: Record<string, string | number | undefined>) => string;
}) {
  const { supabase } = await getAdminSession();
  const { rows, total } = await fetchReceipts(supabase, range);
  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No receipts yet"
          description="A receipt is issued for every payment you record."
        />
      ) : (
        <TableScroll label="Receipts">
          <Table>
            <thead>
              <tr>
                <Th>Receipt</Th>
                <Th>Invoice</Th>
                <Th>Client</Th>
                <Th>Received</Th>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const voided = r.payment.status === "void";
                return (
                  <tr key={r.id} className="align-top">
                    <Td className={cn("font-semibold", voided && "line-through")}>
                      {r.display_number}
                      {voided ? (
                        <span className="ml-2 text-sm font-normal text-danger">Void</span>
                      ) : null}
                    </Td>
                    <Td>
                      <Link
                        href={`/invoices/${r.payment.invoice_id}`}
                        className="inline-flex min-h-11 min-w-11 items-center text-primary underline"
                      >
                        {r.invoiceNumber ?? "Invoice"}
                      </Link>
                    </Td>
                    <Td>{r.clientName}</Td>
                    <Td className="whitespace-nowrap">{formatDay(r.payment.received_at)}</Td>
                    <Td>{methodLabel(r.payment.method)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {money(r.payment.amount_minor, r.payment.currency)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      )}
      <Pagination page={page} total={total} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
