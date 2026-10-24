import type { CurrentMember } from "@corex/core/auth";
import { Button } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Stat } from "@corex/ui/components/stat";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { InvoiceTable } from "@/components/invoice-table";
import { Section } from "@/components/section";
import { money, personName } from "@/lib/format";
import { familyStudents } from "@/lib/highschool";
import { listTerms, rows, termLabel } from "@/lib/queries";
import { BURSAR } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import type { SchoolDb } from "@/lib/supabase";
import { generateInvoices } from "./actions";

export const metadata: Metadata = { title: "Fees" };

type Props = { searchParams: Promise<{ currency?: string; page?: string }> };

export default async function FeesPage({ searchParams }: Props) {
  const { supabase, member } = await requireRoles([...BURSAR, "student", "parent"]);
  if (!memberHas(member, BURSAR)) return <FamilyFees db={supabase} member={member} />;
  const params = await searchParams;
  const currency =
    params.currency === "LRD" ? "LRD" : params.currency === "USD" ? "USD" : undefined;
  const page = pageFrom(params.page);

  let debtorsQuery = supabase
    .from("student_balances")
    .select("student_id, currency, balance_minor, open_invoices", { count: "exact" })
    .gt("balance_minor", 0)
    .order("balance_minor", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (currency) debtorsQuery = debtorsQuery.eq("currency", currency);
  const [totals, debtorsResult, terms] = await Promise.all([
    supabase.from("fee_totals").select("currency, collected_minor, outstanding_minor").then(rows),
    debtorsQuery,
    listTerms(supabase),
  ]);
  if (debtorsResult.error) throw new Error(debtorsResult.error.message);
  const debtors = debtorsResult.data;
  const ids = [
    ...new Set(debtors.map((d) => d.student_id).filter((id): id is string => Boolean(id))),
  ];
  const students = ids.length
    ? rows(
        await supabase
          .from("students")
          .select("id, student_number, first_name, middle_name, last_name")
          .in("id", ids),
      )
    : [];
  const byId = new Map(students.map((s) => [s.id, s]));

  return (
    <>
      <PageHeader title="Fees" description="Amounts are never added across currencies." />
      <div className="flex flex-col gap-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {totals.length === 0 ? (
            <Stat label="Fees" value="No invoices yet" />
          ) : (
            totals.map((t) => (
              <Stat
                key={t.currency}
                label={`Collected (${t.currency})`}
                value={money(t.collected_minor ?? 0, t.currency ?? "USD")}
                detail={`${money(t.outstanding_minor ?? 0, t.currency ?? "USD")} outstanding`}
              />
            ))
          )}
        </div>

        <Section
          title="Issue term invoices"
          id="generate"
          description="One invoice per active student and currency, from the fee structures. Students already invoiced for the term are skipped."
        >
          <ActionForm
            action={generateInvoices}
            aria-label="Issue term invoices"
            className="max-w-2xl rounded-xl border border-border bg-background p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="term_id" label="Term" required>
                <Select defaultValue={terms.find((t) => t.is_current)?.id ?? ""}>
                  <option value="">Choose a term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {termLabel(t)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField name="due_date" label="Due date">
                <Input type="date" />
              </FormField>
            </div>
            <div>
              <SubmitButton pendingLabel="Issuing invoices...">Issue invoices</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Debtors"
          id="debtors"
          description="Students with a balance due, largest first."
          actions={
            <form className="flex items-end gap-2" aria-label="Filter debtors by currency">
              <label htmlFor="currency" className="sr-only">
                Currency
              </label>
              <Select id="currency" name="currency" defaultValue={currency ?? ""} className="w-36">
                <option value="">All currencies</option>
                <option value="USD">USD</option>
                <option value="LRD">LRD</option>
              </Select>
              <Button type="submit" variant="secondary">
                Filter
              </Button>
            </form>
          }
        >
          {debtors.length === 0 ? (
            <p className="text-muted">No balances due.</p>
          ) : (
            <>
              <TableScroll label="Debtors">
                <Table>
                  <thead>
                    <tr>
                      <Th>Student</Th>
                      <Th>Open invoices</Th>
                      <Th className="text-right">Balance due</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtors.map((d) => {
                      const s = d.student_id ? byId.get(d.student_id) : undefined;
                      return (
                        <tr key={`${d.student_id}-${d.currency}`}>
                          <Td>
                            {s ? (
                              <Link
                                className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                                href={`/fees/invoices?student=${s.id}`}
                              >
                                {personName(s)}
                              </Link>
                            ) : (
                              "-"
                            )}
                            <p className="text-sm text-muted">{s?.student_number}</p>
                          </Td>
                          <Td>{d.open_invoices}</Td>
                          <Td className="text-right font-semibold whitespace-nowrap">
                            {money(d.balance_minor ?? 0, d.currency ?? "USD")}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableScroll>
              <Pagination
                page={page}
                total={debtorsResult.count ?? 0}
                hrefFor={(p) =>
                  `/fees?${new URLSearchParams({ ...(currency ? { currency } : {}), page: String(p) }).toString()}`
                }
              />
            </>
          )}
        </Section>
      </div>
    </>
  );
}

/** Students and parents: balances and invoices of their own records (SPEC.md 7.5 portals). */
async function FamilyFees({ db, member }: { db: SchoolDb; member: CurrentMember }) {
  const children = await familyStudents(db, member);
  const own =
    children.length === 1 && memberHas(member, ["student"]) && !memberHas(member, ["parent"]);
  if (children.length === 0) {
    return (
      <PageHeader title="Fees" description="No student record is linked to this account yet." />
    );
  }
  const balances = rows(
    await db
      .from("student_balances")
      .select("student_id, currency, balance_minor")
      .in(
        "student_id",
        children.map((c) => c.id),
      ),
  );
  return (
    <>
      <PageHeader title={own ? "My fees" : "Fees"} />
      <div className="flex flex-col gap-10">
        {children.map((c) => {
          const due = balances.filter((b) => b.student_id === c.id);
          return (
            <Section
              key={c.id}
              title={own ? "Balance and invoices" : personName(c)}
              id={`fees-${c.id}`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {due.length === 0 ? (
                  <Stat label="Balance due" value="Nothing due" />
                ) : (
                  due.map((b) => (
                    <Stat
                      key={b.currency}
                      label={`Balance due (${b.currency})`}
                      value={money(b.balance_minor ?? 0, b.currency ?? "USD")}
                    />
                  ))
                )}
              </div>
              <InvoiceTable
                db={db}
                studentId={c.id}
                page={1}
                hrefFor={() => "/fees"}
                empty={
                  <EmptyState
                    icon={<Wallet />}
                    title="No invoices"
                    description="Fee invoices appear here."
                  />
                }
              />
            </Section>
          );
        })}
      </div>
    </>
  );
}
