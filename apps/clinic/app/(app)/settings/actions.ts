"use server";

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
import { amountText, toMinor } from "@/lib/clinic";
import type { FormState } from "@/lib/form-state";
import { ADMIN, ROLES } from "@/lib/roles";
import { createMemberUser } from "@/lib/users";

const settingsSchema = z.object({
  org_name: requiredText("the organization name", 160),
  address: optionalText,
  phone: optionalText,
  email: optionalText,
  letterhead_text: optionalText,
});

/** Organization details shown in the top bar and on every PDF (CORE-01). */
export async function saveSettings(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: ADMIN, schema: settingsSchema, revalidate: ["/"], demoBlocked: true },
    async (d, { supabase }) => {
      must(await supabase.from("settings").update(d).eq("id", true));
      return "Settings saved.";
    },
  );
}

const serviceSchema = z.object({
  name: requiredText("the service name", 120),
  code: z
    .string({ error: "Enter a code" })
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]{2,12}$/, "Use 2 to 12 letters, digits or dashes")),
  currency: z.enum(["USD", "LRD"], { error: "Choose the currency" }),
  price: amountText,
});

/** Adds a service to the price list that bills are built from (CLN-07). */
export async function addService(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: ADMIN, schema: serviceSchema, revalidate: ["/settings", "/billing"] },
    async (d, { supabase }) => {
      must(
        await supabase.from("services").insert({
          name: d.name,
          code: d.code,
          currency: d.currency,
          price_minor: toMinor(d.price, d.currency),
        }),
      );
      return `${d.name} added to the price list.`;
    },
  );
}

const priceSchema = z.object({ id: uuid("a service"), price: amountText });

/** New bills use the new price; issued bills keep theirs. */
export async function setServicePrice(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: ADMIN, schema: priceSchema, revalidate: ["/settings", "/billing"] },
    async (d, { supabase }) => {
      const service = found(
        await supabase.from("services").select("currency").eq("id", d.id).maybeSingle(),
        "Choose a service.",
      );
      must(
        await supabase
          .from("services")
          .update({ price_minor: toMinor(d.price, service.currency) })
          .eq("id", d.id),
      );
      return "Price updated. Bills already issued keep their prices.";
    },
  );
}

export async function setServiceActive(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    {
      roles: ADMIN,
      schema: z.object({ id: uuid(), active: z.enum(["true", "false"]) }),
      revalidate: ["/settings", "/billing"],
    },
    async (d, { supabase }) => {
      must(
        await supabase
          .from("services")
          .update({ active: d.active === "true" })
          .eq("id", d.id),
      );
      return d.active === "true" ? "Service offered again." : "Service hidden from new bills.";
    },
  );
}

const userSchema = z.object({
  email: z.email("Enter a valid email address").transform((v) => v.toLowerCase()),
  display_name: requiredText("the name", 120),
  role: z.enum(ROLES, { error: "Choose a role" }),
});

/** Creates a sign-in with a temporary password shown once (SPEC.md 5.3, D25). */
export async function createUser(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: ADMIN, schema: userSchema, revalidate: ["/settings"], demoBlocked: true },
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
    { roles: ADMIN, schema: statusSchema, revalidate: ["/settings"], demoBlocked: true },
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
