"use server";

import { MoneyError, parseMajor } from "@corex/core/money";
import { z } from "zod";
import {
  ActionError,
  isoDate,
  must,
  optionalText,
  requiredText,
  runAction,
  uuid,
} from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { BURSAR } from "@/lib/roles";

const opts = <T>(schema: z.ZodType<T>) => ({
  roles: BURSAR,
  schema,
  revalidate: ["/fees", "/students"],
});
const currency = z.enum(["USD", "LRD"], { error: "Choose a currency" });

/** "1,500.50" in the given currency to minor units, or a field error (CORE-04: no floats). */
function amountMinor(input: string, cur: "USD" | "LRD"): number {
  try {
    const value = parseMajor(input, cur).amountMinor;
    if (value <= 0n) throw new ActionError("Enter an amount greater than zero.");
    return Number(value);
  } catch (error) {
    if (error instanceof MoneyError)
      throw new ActionError(`Enter the amount like 1500 or 1,500.50.`);
    throw error;
  }
}

const structureSchema = z.object({
  academic_year_id: uuid("the academic year"),
  term_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  applies_to: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : "all")),
  item: requiredText("the fee item", 120),
  amount: requiredText("the amount", 20),
  currency,
});

export async function addFeeStructure(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(structureSchema), async ({ amount, ...d }, { supabase }) => {
    must(
      await supabase
        .from("fee_structures")
        .insert({ ...d, amount_minor: amountMinor(amount, d.currency) }),
    );
    return `${d.item} added.`;
  });
}

export async function removeFeeStructure(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(z.object({ id: uuid() })), async ({ id }, { supabase }) => {
    must(await supabase.from("fee_structures").delete().eq("id", id));
    return "Fee item removed. Invoices already issued are not changed.";
  });
}

const generateSchema = z.object({
  term_id: uuid("a term"),
  due_date: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date"),
});

/** Bulk invoices for a term (SPEC.md 7.5); students already invoiced are skipped. */
export async function generateInvoices(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(generateSchema), async (d, { supabase }) => {
    const n = must(
      await supabase.rpc("generate_term_invoices", {
        p_term_id: d.term_id,
        p_due_date: d.due_date ?? undefined,
      }),
    );
    return n === 0
      ? "Every active student already has an invoice for this term."
      : `${n} invoice${n === 1 ? "" : "s"} issued.`;
  });
}

const paymentSchema = z.object({
  payment_id: uuid(),
  invoice_id: uuid(),
  currency,
  amount: requiredText("the amount", 20),
  method: z.enum(["cash", "mobile_money", "bank", "other"], { error: "Choose how it was paid" }),
  reference: optionalText,
  received_on: isoDate("the date received"),
});

/** Records a full or partial payment and issues its receipt; retrying never pays twice (CORE-06). */
export async function recordPayment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(paymentSchema), async (d, { supabase }) => {
    const [result] = must(
      await supabase.rpc("record_payment", {
        p_payment_id: d.payment_id,
        p_invoice_id: d.invoice_id,
        p_amount_minor: amountMinor(d.amount, d.currency),
        p_currency: d.currency,
        p_method: d.method,
        p_reference: d.reference ?? undefined,
        p_received_at: `${d.received_on}T12:00:00Z`,
      }),
    );
    return {
      status: "success",
      message: `Payment recorded. Receipt RCT-${String(result?.receipt_number ?? "").padStart(6, "0")} issued.`,
      data: { receipt_id: result?.receipt_id ?? "" },
    };
  });
}

const voidSchema = z.object({ id: uuid(), reason: requiredText("a reason", 500) });

export async function voidPayment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(voidSchema), async (d, { supabase }) => {
    must(await supabase.rpc("void_payment", { p_payment_id: d.id, p_reason: d.reason }));
    return "Payment voided. The receipt stays on record marked void.";
  });
}

export async function voidInvoice(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(voidSchema), async (d, { supabase }) => {
    must(await supabase.rpc("void_invoice", { p_invoice_id: d.id, p_reason: d.reason }));
    return "Invoice voided.";
  });
}
