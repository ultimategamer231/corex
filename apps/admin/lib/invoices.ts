// Invoices, payments and receipts (SPEC-ADMIN.md 9): totals, labels, statuses and form
// rules. Shared by pages, server actions and client forms; keep free of server-only imports.
import { type Currency, CURRENCIES, MoneyError, parseMajor } from "@corex/core/money";
import { z } from "zod";
import { isoDate, optionalText, uuid } from "./fields";

export type Totals = { subtotal: bigint; discount: bigint; tax: bigint; total: bigint };

/** A line's amount: quantity × unit price, rounded half up (the core invoice_lines rule). */
export function lineAmount(quantity: number, unitMinor: bigint): bigint {
  const hundredths = BigInt(Math.round(quantity * 100));
  return (hundredths * unitMinor + 50n) / 100n;
}

/**
 * INV-01 to INV-04, as the database's invoice_totals(): percent discounts and tax round
 * half up; the discount never exceeds the subtotal; tax applies after the discount.
 * Throws when the discount is more than the subtotal.
 */
export function invoiceTotals(
  subtotal: bigint,
  discount: { type: "percent" | "fixed"; value: bigint } | null,
  taxRateBp: number,
): Totals {
  // Percent values arrive as hundredths of a percent (12.5% → 1250n).
  const discountMinor = !discount
    ? 0n
    : discount.type === "percent"
      ? (subtotal * discount.value + 5000n) / 10000n
      : discount.value;
  if (discountMinor > subtotal)
    throw new MoneyError("The discount cannot be more than the subtotal");
  const taxable = subtotal - discountMinor;
  const tax = (taxable * BigInt(taxRateBp) + 5000n) / 10000n;
  return { subtotal, discount: discountMinor, tax, total: taxable + tax };
}

export const INVOICE_KINDS = [
  ["custom", "Custom"],
  ["milestone", "Milestone"],
  ["renewal", "Renewal"],
] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number][0];

export const PAYMENT_METHODS = [
  ["orange_money", "Orange Money"],
  ["mtn_momo", "MTN Mobile Money"],
  ["bank_transfer", "Bank transfer"],
  ["wire", "Wire transfer"],
  ["cash", "Cash"],
  ["usdt", "USDT"],
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number][0];

export function methodLabel(method: string): string {
  return PAYMENT_METHODS.find(([k]) => k === method)?.[1] ?? method;
}

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

/** PAY-04: the stored status, with overdue derived from the due date. */
export function invoiceStatus(
  stored: string,
  dueDate: string | null,
  today: string,
): InvoiceStatus {
  if (stored === "draft" || stored === "void" || stored === "paid") return stored;
  if (dueDate && dueDate < today) return "overdue";
  return stored === "partially_paid" ? "partially_paid" : "sent";
}

export function invoiceStatusBadge(
  status: InvoiceStatus,
): "neutral" | "info" | "warning" | "brand" | "danger" {
  switch (status) {
    case "sent":
      return "info";
    case "partially_paid":
      return "warning";
    case "paid":
      return "brand";
    case "overdue":
      return "danger";
    default:
      return "neutral";
  }
}

/** Repeated form fields arrive as one string or an array of them. */
const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]));

function minor(text: string, currency: Currency): bigint | null {
  try {
    const value = parseMajor(text, currency).amountMinor;
    return value >= 0n ? value : null;
  } catch {
    return null;
  }
}

export type DraftLine = {
  description: string;
  details: string | null;
  quantity: number;
  unitMinor: bigint;
};

/** An invoice draft from the editor: client, kind, currency, terms, discount and lines. */
export const draftSchema = z
  .object({
    invoiceId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    clientId: uuid("a client"),
    kind: z.enum(["custom", "milestone", "renewal"]).catch("custom"),
    contractId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    milestoneNo: z
      .union([z.coerce.number().int().min(1).max(6), z.literal("")])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    renewalFor: z
      .union([isoDate("a date"), z.literal("")])
      .optional()
      .transform((v) => v || null),
    currency: z.enum(CURRENCIES, { error: "Choose a currency" }),
    termsDays: z.coerce
      .number({ error: "Enter the number of days" })
      .int("Use whole days")
      .min(0, "Use 0 or more days")
      .max(365, "Use at most 365 days"),
    discountType: z.enum(["none", "percent", "fixed"]).catch("none"),
    discountValue: optionalText,
    discountReason: optionalText.pipe(z.string().max(300, "Use at most 300 characters").nullable()),
    notes: optionalText.pipe(z.string().max(1000, "Use at most 1000 characters").nullable()),
    lineDescription: list,
    lineDetails: list,
    lineQuantity: list,
    linePrice: list,
  })
  .transform((v, ctx) => {
    const lines: DraftLine[] = [];
    v.lineDescription.forEach((description, i) => {
      const text = description.trim();
      const priceText = v.linePrice[i]?.trim() ?? "";
      if (!text && !priceText) return;
      const quantity = Number(v.lineQuantity[i] || "1");
      const unitMinor = minor(priceText, v.currency);
      if (!text) {
        ctx.addIssue({
          code: "custom",
          path: ["lines"],
          message: `Line ${i + 1}: add a description`,
        });
      }
      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        Math.round(quantity * 100) !== quantity * 100
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["lines"],
          message: `Line ${i + 1}: use a quantity above zero with at most two decimals`,
        });
      }
      if (unitMinor === null) {
        ctx.addIssue({ code: "custom", path: ["lines"], message: `Line ${i + 1}: enter a price` });
      }
      lines.push({
        description: text.slice(0, 200),
        details: v.lineDetails[i]?.trim().slice(0, 500) || null,
        quantity,
        unitMinor: unitMinor ?? 0n,
      });
    });
    if (lines.length === 0) {
      ctx.addIssue({ code: "custom", path: ["lines"], message: "Add at least one line" });
    }
    let discount: { type: "percent" | "fixed"; value: number } | null = null;
    if (v.discountType !== "none") {
      if (v.discountType === "percent") {
        const pct = Number(v.discountValue);
        if (!v.discountValue || !Number.isFinite(pct) || pct < 0 || pct > 100) {
          ctx.addIssue({
            code: "custom",
            path: ["discountValue"],
            message: "Enter a percentage from 0 to 100",
          });
        } else {
          discount = { type: "percent", value: Math.round(pct * 100) / 100 };
        }
      } else {
        const fixed = v.discountValue ? minor(v.discountValue, v.currency) : null;
        if (fixed === null) {
          ctx.addIssue({
            code: "custom",
            path: ["discountValue"],
            message: "Enter the discount amount",
          });
        } else {
          discount = { type: "fixed", value: Number(fixed) };
        }
      }
    }
    return { ...v, lines, discount };
  });

export type Draft = z.output<typeof draftSchema>;

/** The JSON save_invoice_draft() takes. */
export function draftPayload(d: Draft): Record<string, unknown> {
  return {
    client_id: d.clientId,
    kind: d.kind,
    contract_id: d.contractId,
    milestone_no: d.kind === "milestone" ? d.milestoneNo : null,
    renewal_for: d.kind === "renewal" ? d.renewalFor : null,
    currency: d.currency,
    payment_terms_days: d.termsDays,
    discount_type: d.discount?.type ?? null,
    discount_value: d.discount?.value ?? null,
    discount_reason: d.discount ? d.discountReason : null,
    notes: d.notes,
    lines: d.lines.map((l) => ({
      description: l.description,
      details: l.details,
      quantity: l.quantity,
      unit_amount_minor: Number(l.unitMinor),
    })),
  };
}

export const paymentSchema = z
  .object({
    invoiceId: uuid("an invoice"),
    paymentId: uuid("a payment"),
    currency: z.enum(CURRENCIES),
    amount: z.string({ error: "Enter the amount" }).trim().min(1, "Enter the amount"),
    method: z.enum(PAYMENT_METHODS.map(([k]) => k) as [PaymentMethod, ...PaymentMethod[]], {
      error: "Choose how it was paid",
    }),
    reference: optionalText.pipe(z.string().max(100, "Use at most 100 characters").nullable()),
    receivedOn: isoDate("the date received"),
  })
  .transform((v, ctx) => {
    const amountMinor = minor(v.amount, v.currency);
    if (amountMinor === null || amountMinor <= 0n) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount above zero" });
    }
    return { ...v, amountMinor: amountMinor ?? 0n };
  });

export const voidSchema = z.object({
  id: uuid("a record"),
  reason: z
    .string({ error: "Say why" })
    .trim()
    .min(3, "Say why, in a few words")
    .max(300, "Use at most 300 characters"),
});

/** Major units for a form field, without the currency sign ("1,250.00" → "1250.00"). */
export function majorText(minorUnits: bigint | number): string {
  const v = BigInt(minorUnits);
  const sign = v < 0n ? "-" : "";
  const abs = v < 0n ? -v : v;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
