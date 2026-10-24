"use server";

import { z } from "zod";
import { isoDate, must, requiredText, runAction, uuid } from "@/lib/action";
import { toMinor } from "@/lib/finance";
import type { FormState } from "@/lib/form-state";
import { MANAGER } from "@/lib/roles";

const accountSchema = z.object({
  name: requiredText("the account name", 80),
  type: z.enum(["cash", "bank", "mobile_money"], { error: "Choose the type" }),
  currency: z.enum(["USD", "LRD"], { error: "Choose the currency" }),
  opening_balance: z
    .string()
    .trim()
    .regex(/^-?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/, "Enter an amount like 1250.50")
    .optional()
    .or(z.literal("")),
  opened_on: isoDate("the opening date"),
});

/** Adds a cash, bank or mobile money account with its opening balance. */
export async function createAccount(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: MANAGER, schema: accountSchema, revalidate: ["/"] },
    async (d, { supabase }) => {
      const raw = d.opening_balance || "0";
      const negative = raw.startsWith("-");
      const minor = toMinor(negative ? raw.slice(1) : raw, d.currency);
      must(
        await supabase.from("accounts").insert({
          name: d.name,
          type: d.type,
          currency: d.currency,
          opening_balance_minor: negative ? -minor : minor,
          opened_on: d.opened_on,
        }),
      );
      return `Account ${d.name} added.`;
    },
  );
}

const activeSchema = z.object({ id: uuid(), active: z.enum(["true", "false"]) });

/** Closes or reopens an account; closed accounts keep their history. */
export async function setAccountActive(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: MANAGER, schema: activeSchema, revalidate: ["/"] },
    async (d, { supabase }) => {
      must(
        await supabase
          .from("accounts")
          .update({ active: d.active === "true" })
          .eq("id", d.id),
      );
      return d.active === "true" ? "Account reopened." : "Account closed.";
    },
  );
}
