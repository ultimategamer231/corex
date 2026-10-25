import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { formatDateTime } from "@corex/core/dates";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { METHODS, PAYERS, receiptNo } from "@/lib/clinic";
import { money, personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { invoiceStatus } from "@/lib/invoices";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { BILLING } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import {
  addService,
  issueBill,
  recordPayment,
  removeLine,
  voidBill,
  voidPayment,
} from "../actions";

export const metadata: Metadata = { title: "Bill" };

const link = "inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles(BILLING);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const tz = settings.timezone;
  const bill = await supabase
    .from("invoices")
    .select(
      "id, number, party_id, currency, status, issue_date, payer_type, payer_name, encounter_id, notes",
    )
    .eq("id", id)
    .eq("party_type", "patient")
    .maybeSingle()
    .then(rows);
  if (!bill) notFound();
  const c = bill.currency;
  const [lines, balance, patient, payments, services, visit] = await Promise.all([
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
      .from("patients")
      .select("id, patient_number, first_name, middle_name, last_name")
      .eq("id", bill.party_id)
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
    supabase
      .from("services")
      .select("id, name, code, price_minor")
      .eq("currency", c)
      .eq("active", true)
      .order("name")
      .then(rows),
    bill.encounter_id
      ? supabase
          .from("encounters")
          .select("opened_at")
          .eq("id", bill.encounter_id)
          .maybeSingle()
          .then(rows)
      : Promise.resolve(null),
  ]);
  const total = Number(balance?.total_minor ?? 0);
  const paid = Number(balance?.paid_minor ?? 0);
  const due = total - paid;
  const draft = bill.status === "draft";
  const s = invoiceStatus(bill.status);
  const payable = ["issued", "partially_paid"].includes(bill.status) && due > 0;
  const payer = `${PAYERS[bill.payer_type as keyof typeof PAYERS] ?? bill.payer_type}${bill.payer_name ? `: ${bill.payer_name}` : ""}`;

  return (
    <>
      <PageHeader
        title={bill.number ? `Bill No. ${bill.number}` : "Draft bill"}
        description={`${patient ? `${personName(patient)} (${patient.patient_number})` : ""} · ${c} · ${payer}${visit ? ` · visit ${formatDateTime(visit.opened_at, tz)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={s.variant}>{s.label}</Badge>
            {bill.number ? (
              <a
                className={buttonVariants({ variant: "secondary", size: "sm" })}
                href={`/billing/${id}/pdf`}
              >
                Bill PDF
              </a>
            ) : null}
            {patient ? (
              <Link
                className={buttonVariants({ variant: "secondary", size: "sm" })}
                href={`/patients/${patient.id}`}
              >
                Patient
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="flex flex-col gap-10">
        <Section title="Services" id="lines">
          {lines.length === 0 ? (
            <p className="text-muted">No services yet. Add what the patient received below.</p>
          ) : (
            <TableScroll label="Bill lines">
              <Table>
                <thead>
                  <tr>
                    <Th>Service</Th>
                    <Th className="text-right">Quantity</Th>
                    <Th className="text-right">Price</Th>
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
                            title="Remove this service?"
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
                          {money(bill.status === "void" ? 0 : due, c)}
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
              {services.length === 0 ? (
                <p className="text-muted">
                  No {c} services in the price list. Ask the Admin to add them.
                </p>
              ) : (
                <ActionForm
                  action={addService}
                  aria-label="Add a service"
                  className="flex max-w-3xl flex-row flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-5"
                >
                  <input type="hidden" name="invoice_id" value={id} />
                  <FormField name="service_id" label="Service" required className="w-80 max-w-full">
                    <Select defaultValue="">
                      <option value="">Choose a service</option>
                      {services.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}: {money(x.price_minor, c)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField name="quantity" label="Quantity" required className="w-28">
                    <Input type="number" inputMode="numeric" min={1} defaultValue="1" />
                  </FormField>
                  <SubmitButton variant="secondary">Add service</SubmitButton>
                </ActionForm>
              )}
              {lines.length > 0 ? (
                <div>
                  <ConfirmAction
                    action={issueBill}
                    fields={{ id }}
                    triggerLabel="Issue bill"
                    triggerVariant="accent"
                    triggerSize="md"
                    title="Issue this bill?"
                    description={`It gets the next bill number and its services can no longer change. Total ${money(total, c)}.`}
                    confirmLabel="Issue bill"
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
                      <Th>Received</Th>
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
                        <Td className="whitespace-nowrap">{formatDateTime(p.received_at, tz)}</Td>
                        <Td>
                          {METHODS[p.method as keyof typeof METHODS] ?? p.method}
                          {p.reference ? <p className="text-sm text-muted">{p.reference}</p> : null}
                        </Td>
                        <Td className="text-right whitespace-nowrap">{money(p.amount_minor, c)}</Td>
                        <Td>
                          {p.receipts ? (
                            <a className={link} href={`/billing/receipts/${p.receipts.id}/pdf`}>
                              {receiptNo(p.receipts.number)}
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
                              description="The receipt stays on record marked void and the balance goes back up."
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
              <ActionForm
                action={recordPayment}
                aria-label="Record a payment"
                className="max-w-3xl rounded-xl border border-border bg-background p-5"
              >
                <h3 className="text-lg font-bold">Record a payment</h3>
                <input type="hidden" name="payment_id" value={crypto.randomUUID()} />
                <input type="hidden" name="invoice_id" value={id} />
                <input type="hidden" name="currency" value={c} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    name="amount"
                    label={`Amount (${c})`}
                    required
                    hint={`Balance due ${money(due, c)}`}
                  >
                    <Input inputMode="decimal" autoComplete="off" />
                  </FormField>
                  <FormField name="method" label="Method" required>
                    <Select defaultValue="cash">
                      {Object.entries(METHODS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField
                    name="reference"
                    label="Reference"
                    hint="Mobile money or bank reference"
                  >
                    <Input autoComplete="off" />
                  </FormField>
                </div>
                <div>
                  <SubmitButton variant="accent" pendingLabel="Recording...">
                    Record payment
                  </SubmitButton>
                </div>
              </ActionForm>
            ) : null}
            {bill.status !== "void" && !payments.some((p) => p.status === "posted") ? (
              <div>
                <ConfirmAction
                  action={voidBill}
                  fields={{ id }}
                  triggerLabel="Void bill"
                  title="Void this bill?"
                  description="It stays on record marked void and is no longer owed."
                  confirmLabel="Void bill"
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
