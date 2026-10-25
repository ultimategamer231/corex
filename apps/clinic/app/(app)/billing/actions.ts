"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ActionError,
  found,
  must,
  optionalText,
  requiredText,
  runAction,
  uuid,
} from "@/lib/action";
import { amountText, receiptNo, toMinor } from "@/lib/clinic";
import type { FormState } from "@/lib/form-state";
import { BILLING } from "@/lib/roles";

const opts = <T>(schema: z.ZodType<T>) => ({
  roles: BILLING,
  schema,
  revalidate: ["/billing", "/patients", "/"],
});

const billSchema = z
  .object({
    patient_id: uuid("the patient"),
    currency: z.enum(["USD", "LRD"], { error: "Choose the currency" }),
    payer_type: z.enum(["self", "insurance", "company"], { error: "Choose who pays" }),
    payer_name: optionalText,
    encounter_id: z
      .string()
      .optional()
      .transform((v) => v || null),
    notes: optionalText,
  })
  .refine((d) => d.payer_type === "self" || d.payer_name, {
    path: ["payer_name"],
    message: "Enter the insurer or company",
  });

/** Starts a draft bill for a patient, for a visit when one is chosen (SPEC.md 8.2). */
export async function createBill(_p: FormState, formData: FormData): Promise<FormState> {
  let id: string | null = null;
  const result = await runAction(formData, opts(billSchema), async (d, { supabase }) => {
    const row = must(
      await supabase
        .from("invoices")
        .insert({
          party_type: "patient",
          party_id: d.patient_id,
          currency: d.currency,
          payer_type: d.payer_type,
          payer_name: d.payer_type === "self" ? null : d.payer_name,
          encounter_id: d.encounter_id,
          notes: d.notes,
        })
        .select("id")
        .single(),
    );
    id = row.id;
  });
  if (id && result.status === "success") redirect(`/billing/${id}`);
  return result;
}

const lineSchema = z.object({
  invoice_id: uuid(),
  service_id: uuid("a service"),
  quantity: z.coerce
    .number({ error: "Enter the quantity" })
    .int("Enter a whole number")
    .min(1, "At least 1")
    .max(999, "At most 999"),
});

/**
 * Adds a service to a draft bill at its price-list price, read on the server so the
 * total is always the sum of service lines (CLN-07).
 */
export async function addService(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(lineSchema), async (d, { supabase }) => {
    const [invoice, service] = await Promise.all([
      supabase.from("invoices").select("currency, status").eq("id", d.invoice_id).maybeSingle(),
      supabase
        .from("services")
        .select("name, code, price_minor, currency, active")
        .eq("id", d.service_id)
        .maybeSingle(),
    ]);
    const bill = found(invoice, "Bill not found.");
    const s = found(service, "Choose a service.");
    if (bill.status !== "draft") throw new ActionError("Only a draft bill can change.");
    if (!s.active) throw new ActionError("This service is no longer offered.");
    if (s.currency !== bill.currency) {
      throw new ActionError(
        `This service is priced in ${s.currency}; the bill is in ${bill.currency}.`,
      );
    }
    must(
      await supabase.from("invoice_lines").insert({
        invoice_id: d.invoice_id,
        description: `${s.name} (${s.code})`,
        quantity: d.quantity,
        unit_amount_minor: Number(s.price_minor),
        amount_minor: Number(s.price_minor) * d.quantity,
      }),
    );
    return `${s.name} added.`;
  });
}

const idSchema = z.object({ id: uuid() });

export async function removeLine(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(idSchema), async (d, { supabase }) => {
    must(await supabase.from("invoice_lines").delete().eq("id", d.id));
    return "Line removed.";
  });
}

/** Issues a draft: it gets the next bill number and can no longer change. */
export async function issueBill(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(idSchema), async (d, { supabase }) => {
    const number = must(await supabase.rpc("issue_invoice", { p_invoice_id: d.id }));
    return `Bill No. ${number} issued.`;
  });
}

const paymentSchema = z.object({
  payment_id: z.uuid(),
  invoice_id: uuid(),
  currency: z.enum(["USD", "LRD"]),
  amount: amountText,
  method: z.enum(["cash", "mobile_money", "bank", "other"], { error: "Choose how it was paid" }),
  reference: optionalText,
});

/** Records a full or partial payment and its receipt; a retry never pays twice (CORE-06). */
export async function recordPayment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(paymentSchema), async (d, { supabase }) => {
    const [result] = must(
      await supabase.rpc("record_payment", {
        p_payment_id: d.payment_id,
        p_invoice_id: d.invoice_id,
        p_amount_minor: toMinor(d.amount, d.currency),
        p_currency: d.currency,
        p_method: d.method,
        p_reference: d.reference ?? undefined,
      }),
    );
    if (!result) throw new ActionError("The payment could not be recorded.");
    return `Payment recorded. Receipt ${receiptNo(result.receipt_number)} issued.`;
  });
}

const voidSchema = z.object({ id: uuid(), reason: requiredText("a reason", 500) });

export async function voidPayment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(voidSchema), async (d, { supabase }) => {
    must(await supabase.rpc("void_payment", { p_payment_id: d.id, p_reason: d.reason }));
    return "Payment voided. Its receipt stays on record, marked void.";
  });
}

export async function voidBill(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(voidSchema), async (d, { supabase }) => {
    must(await supabase.rpc("void_invoice", { p_invoice_id: d.id, p_reason: d.reason }));
    return "Bill voided.";
  });
}
