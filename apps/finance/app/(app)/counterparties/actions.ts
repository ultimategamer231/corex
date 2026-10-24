"use server";

import { z } from "zod";
import { must, optionalText, requiredText, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { MANAGER, RECORDERS } from "@/lib/roles";

const counterpartySchema = z.object({
  name: requiredText("the name", 120),
  type: z.enum(["customer", "vendor", "both"], { error: "Choose customer, vendor or both" }),
  phone: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address"),
});

export async function createCounterparty(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: RECORDERS, schema: counterpartySchema, revalidate: ["/counterparties"] },
    async (d, { supabase }) => {
      must(await supabase.from("counterparties").insert(d));
      return `${d.name} added.`;
    },
  );
}

export async function updateCounterparty(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    {
      roles: MANAGER,
      schema: counterpartySchema.extend({ id: uuid() }),
      revalidate: ["/counterparties"],
    },
    async ({ id, ...d }, { supabase }) => {
      must(await supabase.from("counterparties").update(d).eq("id", id));
      return "Saved.";
    },
  );
}
