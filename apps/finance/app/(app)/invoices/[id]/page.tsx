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
import { Section } from "@/components/section";
import { loadAccounts, loadCategories, METHODS } from "@/lib/finance";
import { date, money, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { invoiceStatus } from "@/lib/invoices";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import {
  addLine,
  issueInvoice,
  recordPayment,
  removeLine,
  voidInvoice,
  voidPayment,
} from "../actions";

export const metadata: Metadata = { title: "Invoice" };

type Props = { params: Promise<{ id: string }> };

export default async function InvoicePage({ params }: Props) {
  const { supabase } = await requireRoles(MANAGER);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const invoice = await supabase
    .from("invoices")
    .select("id, number, party_id, currency, status, issue_date, due_date, notes")
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!invoice) notFound();
  const [lines, balance, customer, payments, accounts, categories] = await Promise.all([
    supabase
      .from("invoice_lines")
      .select("id, description, quantity, unit_amount_minor, amount_minor")
      .eq("invoice_id", id)
      .order("created_at")
      .then(rows),
    supabase
      .from("invoice_balances")
      .select("total_minor, paid_minor")
      .eq("invoice_id", id)
      .maybeSingle()
      .then(rows),
    supabase
      .from("counterparties")
      .select("name")
      .eq("id", invoice.party_id)
      .maybeSingle()
      .then(rows),
    supabase
      .from("payments")
      .select(
        "id, amount_minor, method, reference, received_at, status, void_reason, receipts(id, number)",
      )
      .eq("invoice_id", id)
      .order("received_at")
      .then(rows),
    loadAccounts(supabase),
    loadCategories(supabase),
  ]);
  const c = invoice.currency;
  const total = Number(balance?.total_minor ?? 0);
  const paid = Number(balance?.paid_minor ?? 0);
  const due = total - paid;
  const draft = invoice.status === "draft";
  const s = invoiceStatus(invoice.status);
  const payable = ["issued", "partially_paid"].includes(invoice.status) && due > 0;
  const intoAccounts = accounts.filter((a) => a.active && a.currency === c);
  const income = categories.filter((x) => x.type === "income" && x.active);

  return (
    <>
      <PageHeader
        title={invoice.number ? `Invoice No. ${invoice.number}` : "Draft invoice"}
        description={`${customer?.name ?? ""} · ${c} · due ${date(invoice.due_date, settings.timezone)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={s.variant}>{s.label}</Badge>
            {invoice.number ? (
              <a
                className={buttonVariants({ variant: "secondary", size: "sm" })}
                href={`/invoices/${id}/pdf`}
              >
                Invoice PDF
              </a>
            ) : null}
          </div>
        }
      />
      <div className="flex flex-col gap-10">
        <Section title="Lines" id="lines">
          {lines.length === 0 ? (
            <p className="text-muted">No lines yet. Add what you are billing for below.</p>
          ) : (
            <TableScroll label="Invoice lines">
              <Table>
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th className="text-right">Quantity</Th>
                    <Th className="text-right">Unit price</Th>
                    <Th className="text-right">Amount</Th>
                    {draft ? (
                      <Th>
                        <span className="sr-only">Remove</span>
                      </Th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <Td>{l.description}</Td>
                      <Td className="text-right">{Number(l.quantity)}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {money(l.unit_amount_minor, c)}
                      </Td>
                      <Td className="text-right whitespace-nowrap">{money(l.amount_minor, c)}</Td>
                      {draft ? (
                        <Td className="text-right">
                          <ConfirmAction
                            action={removeLine}
                            fields={{ id: l.id }}
                            triggerLabel={`Remove ${l.description}`}
                            title="Remove this line?"
                            description={l.description}
                            confirmLabel="Remove"
                          />
                        </Td>
                      ) : null}
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <Td>Total</Td>
                    <Td />
                    <Td />
                    <Td className="text-right whitespace-nowrap">{money(total, c)}</Td>
                    {draft ? <Td /> : null}
                  </tr>
                  {draft ? null : (
                    <>
                      <tr>
                        <Td>Paid</Td>
                        <Td />
                        <Td />
                        <Td className="text-right whitespace-nowrap">{money(paid, c)}</Td>
                      </tr>
                      <tr className="font-bold">
                        <Td>Balance due</Td>
                        <Td />
                        <Td />
                        <Td className="text-right whitespace-nowrap">
                          {money(invoice.status === "void" ? 0 : due, c)}
                        </Td>
                      </tr>
                    </>
                  )}
                </tbody>
              </Table>
            </TableScroll>
          )}
          {draft ? (
            <div className="flex flex-col gap-4">
              <ActionForm
                action={addLine}
                aria-label="Add a line"
                className="max-w-3xl rounded-xl border border-border bg-background p-5"
              >
                <input type="hidden" name="invoice_id" value={id} />
                <input type="hidden" name="currency" value={c} />
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
                  <FormField name="description" label="Description" required>
                    <Input />
                  </FormField>
                  <FormField name="quantity" label="Quantity" required>
                    <Input inputMode="decimal" defaultValue="1" />
                  </FormField>
                  <FormField name="unit_price" label={`Unit price (${c})`} required>
                    <Input inputMode="decimal" />
                  </FormField>
                </div>
                <div>
                  <SubmitButton variant="secondary">Add line</SubmitButton>
                </div>
              </ActionForm>
              {lines.length > 0 ? (
                <div>
                  <ConfirmAction
                    action={issueInvoice}
                    fields={{ id }}
                    triggerLabel="Issue invoice"
                    triggerVariant="accent"
                    title="Issue this invoice?"
                    description={`It gets the next invoice number and its lines can no longer change. Total ${money(total, c)}.`}
                    confirmLabel="Issue invoice"
                    variant="primary"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </Section>

        {draft ? null : (
          <Section title="Payments" id="payments">
            {payments.length === 0 ? (
              <p className="text-muted">No payments yet.</p>
            ) : (
              <TableScroll label="Payments">
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Method</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Receipt</Th>
                      <Th>
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <Td className="whitespace-nowrap">
                          {date(p.received_at, settings.timezone)}
                        </Td>
                        <Td>
                          {METHODS[p.method as keyof typeof METHODS] ?? p.method}
                          {p.reference ? <p className="text-sm text-muted">{p.reference}</p> : null}
                        </Td>
                        <Td className="text-right whitespace-nowrap">{money(p.amount_minor, c)}</Td>
                        <Td>
                          {p.receipts ? (
                            <a
                              className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                              href={`/invoices/receipts/${p.receipts.id}/pdf`}
                            >
                              RCT-{String(p.receipts.number).padStart(6, "0")}
                            </a>
                          ) : null}
                          {p.status === "void" ? (
                            <Badge variant="danger" className="ml-2">
                              Void
                            </Badge>
                          ) : null}
                        </Td>
                        <Td className="text-right">
                          {p.status === "posted" ? (
                            <ConfirmAction
                              action={voidPayment}
                              fields={{ id: p.id }}
                              triggerLabel="Void payment"
                              title="Void this payment?"
                              description="The receipt stays on record marked void, the invoice balance goes back up and the income entry is reversed."
                              confirmLabel="Void payment"
                              reasonLabel="Reason"
                            />
                          ) : null}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            )}
            {payable ? (
              intoAccounts.length === 0 ? (
                <p className="text-muted">Add a {c} account to record payments for this invoice.</p>
              ) : (
                <ActionForm
                  action={recordPayment}
                  aria-label="Record a payment"
                  className="max-w-3xl rounded-xl border border-border bg-background p-5"
                >
                  <h3 className="text-lg font-bold">Record a payment</h3>
                  <input type="hidden" name="payment_id" value={crypto.randomUUID()} />
                  <input type="hidden" name="invoice_id" value={id} />
                  <input type="hidden" name="currency" value={c} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      name="amount"
                      label={`Amount (${c})`}
                      required
                      hint={`Balance due ${money(due, c)}`}
                    >
                      <Input inputMode="decimal" />
                    </FormField>
                    <FormField name="date" label="Date received" required>
                      <Input
                        type="date"
                        defaultValue={todayIso(settings.timezone)}
                        max={todayIso(settings.timezone)}
                      />
                    </FormField>
                    <FormField name="method" label="Method" required>
                      <Select defaultValue="">
                        <option value="">Choose how it was paid</option>
                        {Object.entries(METHODS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField name="account_id" label="Paid into" required>
                      <Select defaultValue={intoAccounts.length === 1 ? intoAccounts[0]?.id : ""}>
                        <option value="">Choose an account</option>
                        {intoAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField name="category_id" label="Income category" required>
                      <Select defaultValue={income.find((x) => x.name === "Sales")?.id ?? ""}>
                        <option value="">Choose a category</option>
                        {income.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField
                      name="reference"
                      label="Reference"
                      hint="Mobile money or bank reference"
                    >
                      <Input />
                    </FormField>
                    {c === settings.baseCurrency ? null : (
                      <FormField
                        name="fx_rate"
                        label={`Rate to ${settings.baseCurrency}`}
                        hint="Leave empty to use the latest rate in Settings."
                      >
                        <Input inputMode="decimal" />
                      </FormField>
                    )}
                  </div>
                  <div>
                    <SubmitButton variant="accent" pendingLabel="Recording...">
                      Record payment
                    </SubmitButton>
                  </div>
                </ActionForm>
              )
            ) : null}
            {invoice.status !== "void" && !payments.some((p) => p.status === "posted") ? (
              <div>
                <ConfirmAction
                  action={voidInvoice}
                  fields={{ id }}
                  triggerLabel="Void invoice"
                  title="Void this invoice?"
                  description="It stays on record marked void and no longer counts as owed."
                  confirmLabel="Void invoice"
                  reasonLabel="Reason"
                />
              </div>
            ) : null}
          </Section>
        )}
      </div>
    </>
  );
}
