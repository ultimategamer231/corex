import { randomUUID } from "node:crypto";
import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@corex/ui/components/card";
import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { cn } from "@corex/ui/lib/utils";
import { Pencil, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { recordPayment, sendInvoice, voidInvoice, voidPayment } from "../actions";
import { FormField } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { FormDialog } from "@/components/form-dialog";
import { DeleteDraft } from "@/components/invoices/delete-draft";
import { BillingPreview } from "@/components/invoices/invoice-preview";
import { ShareInvoice } from "@/components/invoices/share-invoice";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { money } from "@/lib/clients";
import { formatDateTime, formatDay, todayIso } from "@/lib/format";
import { loadInvoiceDocument } from "@/lib/invoice-document-data";
import { fetchReceipts, getInvoice } from "@/lib/invoices-data";
import { majorText, methodLabel, PAYMENT_METHODS } from "@/lib/invoices";
import { getAdminSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await getAdminSession();
  const found = await getInvoice(supabase, id);
  if (!found) notFound();
  return { supabase, ...found };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { invoice } = await load((await params).id);
  return { title: `${invoice.display_number ?? "Draft invoice"} | Invoices` };
}

const KIND_LABEL: Record<string, string> = {
  milestone: "Milestone",
  renewal: "Renewal",
  custom: "Custom",
};

export default async function InvoicePage({ params }: Props) {
  const { id } = await params;
  const { supabase, invoice } = await load(id);
  const [docData, receipts, { data: link }] = await Promise.all([
    loadInvoiceDocument(supabase, id),
    fetchReceipts(supabase, { offset: 0, limit: 100 }, id),
    supabase
      .from("invoice_links")
      .select("expires_at")
      .eq("invoice_id", id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
  ]);
  if (!docData) notFound();
  const { billing, doc } = docData;
  const draft = invoice.status === "draft";
  const open = invoice.status === "issued" || invoice.status === "partially_paid";
  const c = invoice.currency;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/invoices"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Invoices
        </Link>{" "}
        / {invoice.display_number ?? "Draft"}
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn(
                "font-display text-2xl font-bold text-ink sm:text-3xl",
                invoice.status === "void" && "line-through",
              )}
            >
              {invoice.display_number ?? "Draft invoice"}
            </h1>
            <InvoiceStatusBadge status={invoice.shownStatus} />
            <Badge variant="neutral">{KIND_LABEL[invoice.kind] ?? invoice.kind}</Badge>
          </div>
          <p className="text-[15px] text-ink-soft">
            <Link
              href={`/clients/${invoice.party_id}`}
              className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
            >
              {invoice.clientName}
            </Link>
            {" · "}
            {money(invoice.total_minor, c)}
            {invoice.due_date ? ` · due ${formatDay(invoice.due_date)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft ? (
            <>
              <Link
                href={`/invoices/${id}/edit`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                <Pencil aria-hidden="true" />
                Edit draft
              </Link>
              <DeleteDraft invoiceId={id} />
              <ConfirmAction
                action={sendInvoice}
                fields={{ invoiceId: id }}
                triggerLabel="Send invoice"
                triggerVariant="accent"
                variant="primary"
                title="Send this invoice?"
                description={`It gets its number and is due ${invoice.payment_terms_days ?? billing.termsDays} days from today. After this it cannot be edited, only voided.`}
                confirmLabel="Send invoice"
              />
            </>
          ) : null}
          {open ? (
            <FormDialog
              action={recordPayment}
              triggerLabel="Record payment"
              triggerVariant="accent"
              triggerIcon={<Wallet aria-hidden="true" />}
              title="Record payment"
              description={`Balance due: ${money(invoice.balanceMinor, c)}. A receipt is issued automatically.`}
              submitLabel="Record payment"
            >
              <input type="hidden" name="invoiceId" value={id} />
              <input type="hidden" name="paymentId" value={randomUUID()} />
              <input type="hidden" name="currency" value={c} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="amount" label={`Amount (${c})`} required>
                  <Input inputMode="decimal" defaultValue={majorText(invoice.balanceMinor)} />
                </FormField>
                <FormField name="receivedOn" label="Date received" required>
                  <Input type="date" defaultValue={todayIso()} />
                </FormField>
                <FormField name="method" label="Method" required>
                  <Select defaultValue="orange_money">
                    {PAYMENT_METHODS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="reference" label="Reference">
                  <Input placeholder="Transaction ID" />
                </FormField>
              </div>
            </FormDialog>
          ) : null}
          {!draft && invoice.status !== "void" ? (
            <ConfirmAction
              action={voidInvoice}
              fields={{ id }}
              triggerLabel="Void invoice"
              title="Void this invoice?"
              description="It stays visible, struck through, with its number. Void its payments first. To correct it, create a new invoice."
              confirmLabel="Void invoice"
              reasonLabel="Why is it voided?"
            />
          ) : null}
        </div>
      </header>

      {invoice.status === "void" ? (
        <Alert tone="info">
          Voided {formatDay(invoice.voided_at)}: {invoice.void_reason}
        </Alert>
      ) : null}
      {invoice.discount_reason && invoice.discount_minor > 0 ? (
        <p className="text-sm text-muted">Discount reason (internal): {invoice.discount_reason}</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <BillingPreview doc={doc} />
        <div className="flex flex-col gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Share</CardTitle>
            </CardHeader>
            <CardContent>
              <ShareInvoice
                invoiceId={id}
                sent={open || invoice.status === "paid"}
                number={invoice.display_number ?? ""}
                company={billing.company.name}
                contact={doc.billTo.lines[0] ?? null}
                amount={money(
                  invoice.balanceMinor > 0 ? invoice.balanceMinor : invoice.total_minor,
                  c,
                )}
                due={doc.meta[1]?.value ?? ""}
                linkExpires={link ? formatDay(link.expires_at) : null}
                emailEnabled={process.env.CLIENT_EMAIL_ENABLED === "true"}
                defaultEmail={doc.billTo.lines.find((l) => l.includes("@")) ?? ""}
                paid={invoice.status === "paid"}
              />
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Payments and receipts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!draft ? (
                <dl className="grid grid-cols-2 gap-2 text-[15px]">
                  <dt className="text-muted">Total</dt>
                  <dd className="text-right">{money(invoice.total_minor, c)}</dd>
                  <dt className="text-muted">Paid</dt>
                  <dd className="text-right">{money(invoice.paidMinor, c)}</dd>
                  <dt className="font-semibold">Balance</dt>
                  <dd className="text-right font-semibold">{money(invoice.balanceMinor, c)}</dd>
                </dl>
              ) : (
                <p className="text-muted">Payments can be recorded once the invoice is sent.</p>
              )}
              {receipts.rows.length > 0 ? (
                <ul aria-label="Payments" className="flex flex-col divide-y divide-border-subtle">
                  {receipts.rows.map((r) => {
                    const voided = r.payment.status === "void";
                    return (
                      <li key={r.id} className="flex flex-col gap-1 py-3">
                        <p
                          className={cn(
                            "flex justify-between font-semibold",
                            voided && "line-through",
                          )}
                        >
                          <span>{r.display_number}</span>
                          <span>{money(r.payment.amount_minor, r.payment.currency)}</span>
                        </p>
                        <p className="text-sm text-ink-soft">
                          {methodLabel(r.payment.method)}
                          {r.payment.reference ? ` · ${r.payment.reference}` : ""} ·{" "}
                          {formatDay(r.payment.received_at)}
                        </p>
                        <a
                          href={`/invoices/receipts/${r.id}/pdf`}
                          className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-primary underline"
                        >
                          Download receipt<span className="sr-only"> {r.display_number}</span>
                        </a>
                        {voided ? (
                          <p className="text-sm text-danger">Void: {r.payment.void_reason}</p>
                        ) : (
                          <div>
                            <ConfirmAction
                              action={voidPayment}
                              fields={{ id: r.payment.id }}
                              triggerLabel={`Void payment ${r.display_number ?? ""}`}
                              title="Void this payment?"
                              description="The payment and its receipt stay visible, marked void, and the balance goes back up."
                              confirmLabel="Void payment"
                              reasonLabel="Why is it voided?"
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <p className="text-xs text-muted">
                Created {formatDateTime(invoice.created_at)}
                {invoice.sent_at ? ` · sent ${formatDateTime(invoice.sent_at)}` : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
