// The document data that both the on-screen preview and the PDF render (SPEC-ADMIN.md 9.4:
// "the on-screen preview and the PDF use the same data and must match").
import type { BillingDocData } from "@corex/pdf";
import type { BillingSettings } from "./billing-settings";
import { percentText } from "./billing-settings";
import { money } from "./clients";
import { formatDateTime, formatDay } from "./format";
import type { InvoiceLineRow, InvoiceSummary } from "./invoices-data";
import { methodLabel } from "./invoices";

export type BillTo = { name: string; lines: string[] };

const longDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function fullDay(value: string | null | undefined): string {
  if (!value) return "—";
  const day = value.length > 10 ? new Date(value).toISOString().slice(0, 10) : value;
  return longDay.format(new Date(`${day}T00:00:00Z`));
}

function companyLines(b: BillingSettings): string[] {
  return [b.company.address, b.company.taxId ? `TIN ${b.company.taxId}` : null].filter(
    (l): l is string => Boolean(l),
  );
}

function footer(b: BillingSettings, termsDays: number) {
  return {
    questions: [b.company.email, b.company.phone, b.company.website].filter((l): l is string =>
      Boolean(l),
    ),
    paymentInfo: b.paymentInstructions ?? "Add payment instructions in Settings.",
    terms: b.invoiceTerms ?? `Payment is due within ${termsDays} days.`,
  };
}

/** An invoice as the client receives it. */
export function invoiceDocument(
  invoice: InvoiceSummary,
  lines: InvoiceLineRow[],
  billing: BillingSettings,
  billTo: BillTo,
  now = new Date(),
): BillingDocData {
  const c = invoice.currency;
  const draft = invoice.status === "draft";
  const terms = invoice.payment_terms_days ?? billing.termsDays;
  const totals: BillingDocData["totals"] = [
    { label: "Subtotal", value: money(invoice.subtotal_minor, c) },
  ];
  if (invoice.discount_minor > 0) {
    totals.push({
      label:
        invoice.discount_type === "percent" && invoice.discount_value !== null
          ? `Discount (${Number(invoice.discount_value)}%)`
          : "Discount",
      value: `-${money(invoice.discount_minor, c)}`,
    });
  }
  if (invoice.tax_minor > 0) {
    totals.push({
      label: `${billing.taxLabel} (${percentText(invoice.tax_rate_bp)})`,
      value: money(invoice.tax_minor, c),
    });
  }
  if (invoice.paidMinor > 0) {
    totals.push({ label: "Paid", value: `-${money(invoice.paidMinor, c)}` });
  }
  return {
    kind: "invoice",
    company: { name: billing.company.name, lines: companyLines(billing) },
    number: invoice.display_number,
    watermark: draft ? "DRAFT" : invoice.status === "void" ? "VOID" : null,
    meta: [
      { label: "Date", value: invoice.issue_date ? fullDay(invoice.issue_date) : "On sending" },
      {
        label: "Due",
        value: invoice.due_date ? fullDay(invoice.due_date) : `${terms} days after sending`,
      },
    ],
    billTo,
    lines: lines.map((l) => ({
      title: l.description,
      details: l.details,
      quantity: String(Number(l.quantity)),
      unit: money(l.unit_amount_minor, c),
      amount: money(l.amount_minor, c),
    })),
    totals,
    grand: {
      label: "TOTAL DUE",
      value: money(
        draft || invoice.status === "void" ? invoice.total_minor : invoice.balanceMinor,
        c,
      ),
      tone: "primary",
    },
    note: invoice.notes,
    ...footer(billing, terms),
    generatedAt: formatDateTime(now),
  };
}

export type ReceiptInput = {
  number: string | null;
  issuedAt: string;
  voided: boolean;
  amountMinor: number;
  currency: string;
  method: string;
  reference: string | null;
  receivedAt: string;
  invoiceNumber: string | null;
  invoiceTotalMinor: number;
  balanceAfterMinor: number;
};

/** A receipt for one payment (PAY-03). */
export function receiptDocument(
  r: ReceiptInput,
  billing: BillingSettings,
  billTo: BillTo,
  now = new Date(),
): BillingDocData {
  const c = r.currency;
  return {
    kind: "receipt",
    company: { name: billing.company.name, lines: companyLines(billing) },
    number: r.number,
    watermark: r.voided ? "VOID" : null,
    meta: [
      { label: "Date", value: fullDay(r.issuedAt) },
      { label: "Invoice", value: r.invoiceNumber ?? "—" },
    ],
    billTo,
    lines: [
      {
        title: `Payment for invoice ${r.invoiceNumber ?? ""}`.trim(),
        details: `${methodLabel(r.method)}${r.reference ? ` · ${r.reference}` : ""} · received ${formatDay(r.receivedAt)}`,
        quantity: "1",
        unit: money(r.amountMinor, c),
        amount: money(r.amountMinor, c),
      },
    ],
    totals: [
      { label: "Invoice total", value: money(r.invoiceTotalMinor, c) },
      { label: "Balance after", value: money(r.balanceAfterMinor, c) },
    ],
    grand: { label: "AMOUNT PAID", value: money(r.amountMinor, c), tone: "paid" },
    note: r.voided ? "This receipt is void: its payment was cancelled." : null,
    questions: footer(billing, billing.termsDays).questions,
    paymentInfo: null,
    terms: null,
    generatedAt: formatDateTime(now),
  };
}

export type QuoteInput = {
  organization: string;
  contact: string;
  amountMinor: number;
  currency: string;
  sentOn: string | null;
  note: string | null;
  product: string;
};

/** A lead's quote (the mockup's "Download quote PDF"), same layout titled QUOTE. */
export function quoteDocument(
  q: QuoteInput,
  billing: BillingSettings,
  now = new Date(),
): BillingDocData {
  return {
    kind: "quote",
    company: { name: billing.company.name, lines: companyLines(billing) },
    number: `For ${q.organization}`,
    watermark: null,
    meta: [{ label: "Date", value: fullDay(q.sentOn ?? now.toISOString()) }],
    billTo: { name: q.organization, lines: [q.contact] },
    lines: [
      {
        title: q.product,
        details: q.note,
        quantity: "1",
        unit: money(q.amountMinor, q.currency),
        amount: money(q.amountMinor, q.currency),
      },
    ],
    totals: [],
    grand: { label: "TOTAL", value: money(q.amountMinor, q.currency), tone: "primary" },
    note: "This quote is valid for 30 days.",
    ...footer(billing, billing.termsDays),
    generatedAt: formatDateTime(now),
  };
}
