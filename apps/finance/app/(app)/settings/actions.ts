"use server";

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
import { getSettings } from "@/lib/org";
import { MANAGER, OWNER, type Role } from "@/lib/roles";
import { createMemberUser } from "@/lib/users";

const settingsSchema = z.object({
  org_name: requiredText("the organization name", 160),
  address: optionalText,
  phone: optionalText,
  email: optionalText,
  letterhead_text: optionalText,
  base_currency: z.enum(["USD", "LRD"]),
});

/**
 * Organization details (CORE-01). The base currency can change only before the first
 * entry, since every entry keeps its rate to the base currency (FIN-03).
 */
export async function saveSettings(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: OWNER, schema: settingsSchema, revalidate: ["/"], demoBlocked: true },
    async (d, { supabase }) => {
      const current = await getSettings();
      if (d.base_currency !== current.baseCurrency) {
        const { count } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true });
        if ((count ?? 0) > 0) {
          throw new ActionError(
            "The base currency cannot change after entries have been recorded.",
          );
        }
      }
      must(
        await supabase
          .from("settings")
          .update({
            org_name: d.org_name,
            address: d.address,
            phone: d.phone,
            email: d.email,
            letterhead_text: d.letterhead_text,
            base_currency: d.base_currency,
            enabled_currencies: ["USD", "LRD"],
          })
          .eq("id", true),
      );
      return "Settings saved.";
    },
  );
}

const categorySchema = z.object({
  name: requiredText("the category name", 80),
  type: z.enum(["income", "expense"], { error: "Choose income or expense" }),
});

export async function addCategory(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: MANAGER, schema: categorySchema, revalidate: ["/settings"] },
    async (d, { supabase }) => {
      must(await supabase.from("categories").insert(d));
      return `Category ${d.name} added.`;
    },
  );
}

export async function setCategoryActive(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    {
      roles: MANAGER,
      schema: z.object({ id: uuid(), active: z.enum(["true", "false"]) }),
      revalidate: ["/settings"],
    },
    async (d, { supabase }) => {
      must(
        await supabase
          .from("categories")
          .update({ active: d.active === "true" })
          .eq("id", d.id),
      );
      return d.active === "true" ? "Category back in use." : "Category hidden from new entries.";
    },
  );
}

const rateSchema = z
  .object({
    date: isoDate("the date"),
    from_currency: z.enum(["USD", "LRD"]),
    to_currency: z.enum(["USD", "LRD"]),
    rate: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,6})?$/, "Enter a rate like 190 or 0.005263")
      .refine((v) => Number(v) > 0, "The rate must be greater than zero"),
  })
  .refine((v) => v.from_currency !== v.to_currency, {
    path: ["to_currency"],
    message: "Choose two different currencies",
  });

/** A reference rate that prefills entries; saved entries keep their own rate (FIN-03). */
export async function addRate(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: MANAGER, schema: rateSchema, revalidate: ["/settings"] },
    async (d, { supabase }) => {
      must(
        await supabase
          .from("exchange_rates")
          .upsert({ ...d, rate: Number(d.rate) }, { onConflict: "date,from_currency,to_currency" }),
      );
      return `Rate saved: 1 ${d.from_currency} = ${d.rate} ${d.to_currency}.`;
    },
  );
}

const STAFF_ROLES = ["owner", "admin", "accountant", "staff"] as const satisfies readonly Role[];

const userSchema = z.object({
  email: z.email("Enter a valid email address").transform((v) => v.toLowerCase()),
  display_name: requiredText("the name", 120),
  role: z.enum(STAFF_ROLES, { error: "Choose a role" }),
});

/** Creates a sign-in with a temporary password shown once (SPEC.md 5.3, D25). */
export async function createUser(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: OWNER, schema: userSchema, revalidate: ["/settings"], demoBlocked: true },
    async (d, { supabase }) => {
      const { password } = await createMemberUser(supabase, {
        email: d.email,
        displayName: d.display_name,
        role: d.role,
      });
      return `Account created for ${d.email}. Temporary password: ${password} (shown once; ask them to change it).`;
    },
  );
}

const statusSchema = z.object({
  user_id: z.uuid(),
  role: z.string().min(1),
  status: z.enum(["active", "suspended"]),
});

export async function setMembershipStatus(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: OWNER, schema: statusSchema, revalidate: ["/settings"], demoBlocked: true },
    async (d, { supabase, member }) => {
      if (d.user_id === member.userId)
        throw new ActionError("You cannot suspend your own account.");
      must(
        await supabase
          .from("memberships")
          .update({ status: d.status })
          .eq("user_id", d.user_id)
          .eq("role", d.role),
      );
      return d.status === "suspended" ? "Access suspended." : "Access restored.";
    },
  );
}
