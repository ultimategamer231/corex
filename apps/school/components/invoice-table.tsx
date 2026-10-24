import { Badge } from "@corex/ui/components/badge";
import { PAGE_SIZE, Pagination } from "@corex/ui/components/pagination";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import Link from "next/link";
import type * as React from "react";
import { date, money, personName } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import type { SchoolDb } from "@/lib/supabase";

export const INVOICE_STATUS_BADGE = {
  draft: "neutral",
  issued: "info",
  partially_paid: "warning",
  paid: "brand",
  void: "neutral",
} as const;

export function invoiceLabel(number: number | null): string {
  return number ? `INV-${String(number).padStart(6, "0")}` : "Draft";
}

/** Student fee invoices with totals and balances in each invoice's own currency (CORE-05). */
export async function InvoiceTable({
  db,
  studentId,
  status,
  page,
  hrefFor,
  empty,
}: {
  db: SchoolDb;
  studentId?: string;
  status?: string;
  page: number;
  hrefFor: (page: number) => string;
  empty: React.ReactNode;
}) {
  const settings = await getSettings();
  let query = db
    .from("invoices")
    .select("id, number, party_id, currency, status, issue_date, due_date", { count: "exact" })
    .eq("party_type", "student")
    .order("number", { ascending: false, nullsFirst: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (studentId) query = query.eq("party_id", studentId);
  if (status) query = query.eq("status", status);
  const { data: invoices, count, error } = await query;
  if (error) throw new Error(error.message);
  if (invoices.length === 0) return <>{empty}</>;
  const ids = invoices.map((i) => i.id);
  const studentIds = [...new Set(invoices.map((i) => i.party_id))];
  const [balances, students] = await Promise.all([
    db
      .from("invoice_balances")
      .select("invoice_id, total_minor, paid_minor")
      .in("invoice_id", ids)
      .then(rows),
    db
      .from("students")
      .select("id, student_number, first_name, middle_name, last_name")
      .in("id", studentIds)
      .then(rows),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.invoice_id, b]));
  const studentOf = new Map(students.map((s) => [s.id, s]));
  return (
    <div className="flex flex-col gap-4">
      <TableScroll label="Invoices">
        <Table>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Student</Th>
              <Th>Issued</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Balance</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => {
              const b = balanceOf.get(i.id);
              const s = studentOf.get(i.party_id);
              return (
                <tr key={i.id}>
                  <Td className="font-mono text-sm whitespace-nowrap">
                    <Link
                      className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                      href={`/fees/invoices/${i.id}`}
                    >
                      {invoiceLabel(i.number)}
                    </Link>
                  </Td>
                  <Td>{s ? personName(s) : "-"}</Td>
                  <Td className="whitespace-nowrap">{date(i.issue_date, settings.timezone)}</Td>
                  <Td>
                    <Badge
                      variant={
                        INVOICE_STATUS_BADGE[i.status as keyof typeof INVOICE_STATUS_BADGE] ??
                        "neutral"
                      }
                    >
                      {i.status.replace("_", " ")}
                    </Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {money(b?.total_minor ?? 0, i.currency)}
                  </Td>
                  <Td className="text-right font-semibold whitespace-nowrap">
                    {i.status === "void"
                      ? "-"
                      : money((b?.total_minor ?? 0) - (b?.paid_minor ?? 0), i.currency)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableScroll>
      <Pagination page={page} total={count ?? 0} hrefFor={hrefFor} />
    </div>
  );
}
