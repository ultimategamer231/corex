"use server";

import { lineAmount, parseMajor } from "@corex/core/money";
import { redirect } from "next/navigation";
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
import { amountText, rateText, toMinor } from "@/lib/finance";
import type { FormState } from "@/lib/form-state";
import { MANAGER } from "@/lib/roles";

const opts = <T>(schema: z.ZodType<T>) => ({
  roles: MANAGER,
  schema,
  revalidate: ["/invoices", "/"],
});

const invoiceSchema = z.object({
  party_id: uuid("a customer"),
  currency: z.enum(["USD", "LRD"], { error: "Choose the currency" }),
  due_date: isoDate("the due date"),
  notes: optionalText,
});

/** Starts a draft invoice for a customer (SPEC.md 9.2). */
export async function createInvoice(_p: FormState, formData: FormData): Promise<FormState> {
  let id: string | null = null;
  const result = await runAction(formData, opts(invoiceSchema), async (d, { supabase }) => {
    const row = must(
      await supabase
        .from("invoices")
        .insert({ party_type: "counterparty", ...d })
        .select("id")
        .single(),
    );
    id = row.id;
  });
  if (id && result.status === "success") redirect(`/invoices/${id}`);
  return result;
}

const lineSchema = z.object({
  invoice_id: uuid(),
  currency: z.enum(["USD", "LRD"]),
  description: requiredText("a description", 200),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a quantity like 2 or 1.5")
    .refine((v) => Number(v) > 0, "The quantity must be greater than zero"),
  unit_price: amountText,
});

/** Adds a line to a draft invoice; the amount is quantity times unit price (D16). */
export async function addLine(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(lineSchema), async (d, { supabase }) => {
    const unit = parseMajor(d.unit_price.replace(/,/g, ""), d.currency);
    must(
      await supabase.from("invoice_lines").insert({
        invoice_id: d.invoice_id,
        description: d.description,
        quantity: Number(d.quantity),
        unit_amount_minor: Number(unit.amountMinor),
        amount_minor: Number(lineAmount(d.quantity, unit).amountMinor),
      }),
    );
    return "Line added.";
  });
}

const idSchema = z.object({ id: uuid() });

export async function removeLine(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(idSchema), async (d, { supabase }) => {
    must(await supabase.from("invoice_lines").delete().eq("id", d.id));
    return "Line removed.";
  });
}

/** Issues a draft: it gets the next invoice number and can no longer change. */
export async function issueInvoice(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(idSchema), async (d, { supabase }) => {
    const number = must(await supabase.rpc("issue_invoice", { p_invoice_id: d.id }));
    return `Invoice No. ${number} issued.`;
  });
}

const paymentSchema = z.object({
  payment_id: z.uuid(),
  invoice_id: uuid(),
  currency: z.enum(["USD", "LRD"]),
  amount: amountText,
  date: isoDate("the date received"),
  method: z.enum(["cash", "bank", "mobile_money", "other"], { error: "Choose how it was paid" }),
  account_id: uuid("the account it was paid into"),
  category_id: uuid("an income category"),
  reference: optionalText,
  fx_rate: rateText,
});

/**
 * Records a full or partial payment, its receipt and the matching income entry in
 * the account; retrying with the same payment id never pays twice (CORE-06).
 */
export async function recordPayment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(paymentSchema), async (d, { supabase }) => {
    const [result] = must(
      await supabase.rpc("record_invoice_payment", {
        p_payment_id: d.payment_id,
        p_invoice_id: d.invoice_id,
        p_amount_minor: toMinor(d.amount, d.currency),
        p_method: d.method,
        p_account_id: d.account_id,
        p_category_id: d.category_id,
        p_date: d.date,
        p_reference: d.reference ?? undefined,
        p_fx_rate: d.fx_rate ? Number(d.fx_rate) : undefined,
      }),
    );
    if (!result) throw new ActionError("The payment could not be recorded.");
    return `Payment recorded. Receipt RCT-${String(result.receipt_number).padStart(6, "0")} issued.`;
  });
}

const voidSchema = z.object({ id: uuid(), reason: requiredText("a reason", 500) });

/** Voids a payment and reverses its income entry; the receipt stays, marked void. */
export async function voidPayment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(voidSchema), async (d, { supabase }) => {
    must(await supabase.rpc("void_invoice_payment", { p_payment_id: d.id, p_reason: d.reason }));
    return "Payment voided. Its income entry was reversed.";
  });
}

export async function voidInvoice(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(voidSchema), async (d, { supabase }) => {
    must(await supabase.rpc("void_invoice", { p_invoice_id: d.id, p_reason: d.reason }));
    return "Invoice voided.";
  });
}
