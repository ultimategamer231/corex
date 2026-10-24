"use server";

import { z } from "zod";
import { ActionError, must, optionalText, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { REGISTRAR } from "@/lib/roles";

const opts = <T>(schema: z.ZodType<T>) => ({
  roles: REGISTRAR,
  schema,
  revalidate: ["/registration", "/students"],
});

const decisionSchema = z.object({
  registration_id: uuid(),
  decision: z.enum(["approve", "reject"]),
  reason: optionalText,
});

export async function decide(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(decisionSchema), async (d, { supabase }) => {
    must(
      await supabase.rpc("decide_registration", {
        p_registration_id: d.registration_id,
        p_approve: d.decision === "approve",
        p_note: d.reason ?? undefined,
      }),
    );
    return d.decision === "approve" ? "Course approved." : "Course rejected.";
  });
}

const allSchema = z.object({
  registration_ids: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v])),
});

/** Approves each submitted course of a plan; full courses are reported, the rest approved. */
export async function approveAll(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(allSchema), async (d, { supabase }) => {
    const problems: string[] = [];
    for (const id of d.registration_ids) {
      if (!z.uuid().safeParse(id).success) continue;
      const { error } = await supabase.rpc("decide_registration", {
        p_registration_id: id,
        p_approve: true,
      });
      if (error) problems.push(error.message);
    }
    if (problems.length)
      throw new ActionError(`Some courses were not approved: ${problems.join("; ")}`);
    return "All courses approved.";
  });
}

const returnSchema = z.object({ student_id: uuid(), term_id: uuid(), reason: optionalText });

export async function returnPlan(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(returnSchema), async (d, { supabase }) => {
    must(
      await supabase.rpc("return_plan", {
        p_student_id: d.student_id,
        p_term_id: d.term_id,
        p_note: d.reason ?? "",
      }),
    );
    return "Plan returned to the student.";
  });
}
