"use server";

import { z } from "zod";
import { ActionError, must, optionalText, requiredText, runAction } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { schoolEnv } from "@/lib/env";
import { getSettings } from "@/lib/org";
import { EDITION_ROLES, type Role } from "@/lib/roles";
import { createMemberUser } from "@/lib/users";

const ADMIN = ["super_admin"] as const;
const credits = (label: string) =>
  z.coerce
    .number({ error: `Enter ${label}` })
    .int("Use a whole number")
    .min(1)
    .max(60);

const settingsSchema = z
  .object({
    org_name: requiredText("the school name", 160),
    address: optionalText,
    phone: optionalText,
    email: optionalText,
    letterhead_text: optionalText,
    base_currency: z.enum(["USD", "LRD"]),
    lrd_enabled: z.string().optional(),
    usd_enabled: z.string().optional(),
    student_number_prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,6}$/, "Use 2 to 6 letters, for example STU"),
    max_credits_per_term: credits("the maximum credits"),
    min_credits_per_term: credits("the minimum credits"),
    repeat_policy: z.enum(["latest", "best", "all"]),
  })
  .refine((d) => d.min_credits_per_term <= d.max_credits_per_term, {
    path: ["min_credits_per_term"],
    message: "The minimum cannot be above the maximum",
  });

/** Organization details and College rules (CORE-01: read from settings, never hardcoded). */
export async function saveSettings(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: ADMIN, schema: settingsSchema, revalidate: ["/"] },
    async (d, { supabase }) => {
      const current = await getSettings();
      const enabled = [
        d.usd_enabled === "on" ? "USD" : null,
        d.lrd_enabled === "on" ? "LRD" : null,
      ].filter((c): c is "USD" | "LRD" => c !== null);
      if (!enabled.includes(d.base_currency))
        throw new ActionError("The base currency must be one of the enabled currencies.");
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
            enabled_currencies: enabled,
            config: {
              ...current.config,
              student_number_prefix: d.student_number_prefix,
              max_credits_per_term: d.max_credits_per_term,
              min_credits_per_term: d.min_credits_per_term,
              repeat_policy: d.repeat_policy,
            },
          })
          .eq("id", true),
      );
      return "Settings saved.";
    },
  );
}

const userSchema = z.object({
  email: z.email("Enter a valid email address").transform((v) => v.toLowerCase()),
  display_name: requiredText("the name", 120),
  role: z.string(),
});

/** Creates a staff sign-in with a temporary password shown once (SPEC.md 5.3). */
export async function createUser(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: ADMIN, schema: userSchema, revalidate: ["/settings"] },
    async (d, { supabase }) => {
      const roles: readonly string[] = EDITION_ROLES[schoolEnv().edition];
      if (!roles.includes(d.role) || d.role === "student" || d.role === "parent") {
        return { status: "error", fieldErrors: { role: "Choose a staff role" } };
      }
      const { password } = await createMemberUser(supabase, {
        email: d.email,
        displayName: d.display_name,
        role: d.role as Role,
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

/** Suspends or restores a membership; a suspended user loses access at once (SPEC.md 5.3). */
export async function setMembershipStatus(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: ADMIN, schema: statusSchema, revalidate: ["/settings"] },
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
