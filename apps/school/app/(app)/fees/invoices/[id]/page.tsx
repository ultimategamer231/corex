import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { INVOICE_STATUS_BADGE, invoiceLabel } from "@/components/invoice-table";
import { Section } from "@/components/section";
import { date, money, personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { BURSAR } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { recordPayment, voidInvoice, voidPayment } from "../../actions";

export const metadata: Metadata = { title: "Invoice" };

const METHOD = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank transfer",
  other: "Other",
} as const;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, member } = await requireRoles([...BURSAR, "student"]);
  const bursar = memberHas(member, BURSAR);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, number, party_id, currency, status, issue_date, due_date, notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) notFound();
  const [lines, payments, balance, student] = await Promise.all([
    supabase
      .from("invoice_lines")
      .select("id, description, quantity, unit_amount_minor, amount_minor")
      .eq("invoice_id", id)
      .order("created_at")
      .then(rows),
    supabase
      .from("payments")
      .select(
        "id, amount_minor, currency, method, reference, received_at, status, void_reason, receipts(id, number)",
      )
      .eq("invoice_id", id)
      .order("received_at")
      .then(rows),
    supabase
      .from("invoice_balances")
      .select("total_minor, paid_minor")
      .eq("invoice_id", id)
      .maybeSingle()
      .then(rows),
    supabase
      .from("students")
      .select("id, student_number, first_name, middle_name, last_name")
      .eq("id", invoice.party_id)
      .maybeSingle()
      .then(rows),
  ]);
  const total = balance?.total_minor ?? 0;
  const paid = balance?.paid_minor ?? 0;
  const due = total - paid;
  const label = invoiceLabel(invoice.number);
  const open = invoice.status === "issued" || invoice.status === "partially_paid";
  const tz = settings.timezone;

  return (
    <>
      <PageHeader
        title={`Invoice ${label}`}
        description={`${student ? `${personName(student)} · ${student.student_number}` : ""} · issued ${date(invoice.issue_date, tz)}${invoice.due_date ? ` · due ${date(invoice.due_date, tz)}` : ""}`}
        actions={
          <>
            {invoice.number ? (
              <a
                className={buttonVariants({ variant: "secondary" })}
                href={`/fees/invoices/${id}/pdf`}
              >
                Invoice PDF
              </a>
            ) : null}
            {bursar && open && payments.every((p) => p.status === "void") ? (
              <ConfirmAction
                action={voidInvoice}
                fields={{ id }}
                triggerLabel="Void invoice"
                triggerSize="md"
                title={`Void invoice ${label}?`}
                description="The invoice keeps its number and stays on record marked void."
                confirmLabel="Void invoice"
                reasonLabel="Reason"
              />
            ) : null}
          </>
        }
      />
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={
              INVOICE_STATUS_BADGE[invoice.status as keyof typeof INVOICE_STATUS_BADGE] ?? "neutral"
            }
          >
            {invoice.status.replace("_", " ")}
          </Badge>
          <p>
            Total <strong>{money(total, invoice.currency)}</strong> · Paid{" "}
            <strong>{money(paid, invoice.currency)}</strong> · Balance due{" "}
            <strong>{money(invoice.status === "void" ? 0 : due, invoice.currency)}</strong>
          </p>
        </div>

        <Section title="Items" id="lines">
          <TableScroll label="Invoice items">
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th className="text-right">Quantity</Th>
                  <Th className="text-right">Unit price ({invoice.currency})</Th>
                  <Th className="text-right">Amount ({invoice.currency})</Th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.description}</Td>
                    <Td className="text-right">{Number(l.quantity)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {money(l.unit_amount_minor, invoice.currency)}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {money(l.amount_minor, invoice.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </Section>

        <Section title="Payments" id="payments">
          {payments.length === 0 ? (
            <p className="text-muted">No payments yet.</p>
          ) : (
            <TableScroll label="Payments">
              <Table>
                <thead>
                  <tr>
                    <Th>Received</Th>
                    <Th>Method</Th>
                    <Th>Receipt</Th>
                    <Th className="text-right">Amount ({invoice.currency})</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const receipt = p.receipts;
                    const receiptLabel = receipt
                      ? `RCT-${String(receipt.number).padStart(6, "0")}`
                      : "-";
                    return (
                      <tr key={p.id}>
                        <Td className="whitespace-nowrap">{date(p.received_at, tz)}</Td>
                        <Td>
                          {METHOD[p.method as keyof typeof METHOD] ?? p.method}
                          {p.reference ? <p className="text-sm text-muted">{p.reference}</p> : null}
                        </Td>
                        <Td>
                          {receipt ? (
                            <a
                              className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                              href={`/fees/receipts/${receipt.id}/pdf`}
                            >
                              {receiptLabel}
                            </a>
                          ) : (
                            "-"
                          )}
                          {p.status === "void" ? (
                            <p className="text-sm text-danger">
                              <Badge variant="danger">void</Badge> {p.void_reason}
                            </p>
                          ) : null}
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          {money(p.amount_minor, p.currency)}
                        </Td>
                        <Td className="text-right">
                          {bursar && p.status === "posted" ? (
                            <ConfirmAction
                              action={voidPayment}
                              fields={{ id: p.id }}
                              triggerLabel={`Void ${receiptLabel}`}
                              title={`Void payment ${receiptLabel}?`}
                              description="The payment and receipt stay on record marked void, and the balance goes back up."
                              confirmLabel="Void payment"
                              reasonLabel="Reason"
                            />
                          ) : null}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>

        {bursar && open ? (
          <Section
            title="Record a payment"
            id="pay"
            description={`Full or part payment in ${invoice.currency}. Up to ${money(due, invoice.currency)} is due.`}
          >
            <ActionForm
              action={recordPayment}
              aria-label="Record a payment"
              className="max-w-2xl rounded-xl border border-border bg-background p-5"
            >
              <input type="hidden" name="payment_id" value={crypto.randomUUID()} />
              <input type="hidden" name="invoice_id" value={id} />
              <input type="hidden" name="currency" value={invoice.currency} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="amount" label={`Amount (${invoice.currency})`} required>
                  <Input inputMode="decimal" placeholder="1,000.00" />
                </FormField>
                <FormField name="method" label="Paid by" required>
                  <Select defaultValue="cash">
                    {Object.entries(METHOD).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  name="reference"
                  label="Reference"
                  hint="Mobile money or bank reference."
                >
                  <Input />
                </FormField>
                <FormField name="received_on" label="Date received" required>
                  <Input type="date" defaultValue={todayIso(tz)} max={todayIso(tz)} />
                </FormField>
              </div>
              <div>
                <SubmitButton variant="accent" pendingLabel="Recording...">
                  Record payment
                </SubmitButton>
              </div>
            </ActionForm>
          </Section>
        ) : null}
      </div>
    </>
  );
}
