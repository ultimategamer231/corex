"use server";

import { z } from "zod";
import { must, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";

const opts = <T>(schema: z.ZodType<T>) => ({
  roles: ["student"] as const,
  schema,
  revalidate: ["/planning"],
});

/** Adds an offering to the plan; the database checks every rule (SCH-05). */
export async function planCourse(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    opts(z.object({ offering_id: uuid("a course") })),
    async (d, { supabase }) => {
      must(await supabase.rpc("plan_course", { p_offering_id: d.offering_id }));
      return "Added to your plan.";
    },
  );
}

export async function unplanCourse(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    opts(z.object({ registration_id: uuid() })),
    async (d, { supabase }) => {
      must(await supabase.rpc("unplan_course", { p_registration_id: d.registration_id }));
      return "Removed from your plan.";
    },
  );
}

export async function submitPlan(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(z.object({ term_id: uuid() })), async (d, { supabase }) => {
    const [result] = must(await supabase.rpc("submit_plan", { p_term_id: d.term_id }));
    if (result?.below_minimum) {
      return `Plan submitted to the Registrar. Note: ${result.credits} credits is below the usual minimum of ${result.min_credits}.`;
    }
    return "Plan submitted to the Registrar.";
  });
}
