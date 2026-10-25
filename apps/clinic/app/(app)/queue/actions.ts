"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, must, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { vitalsSchema } from "@/lib/schemas";
import { CLINICAL, CLINICIAN, FRONT_DESK } from "@/lib/roles";

/** Adds a walk-in patient to today's queue. */
export async function addWalkIn(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    {
      roles: FRONT_DESK,
      schema: z.object({ patient_id: uuid("the patient") }),
      revalidate: ["/queue", "/"],
    },
    async (d, { supabase }) => {
      const waiting = await supabase
        .from("queue_entries")
        .select("id")
        .eq("patient_id", d.patient_id)
        .neq("status", "done")
        .limit(1);
      if (waiting.data?.length) throw new ActionError("This patient is already in the queue.");
      must(await supabase.from("queue_entries").insert({ patient_id: d.patient_id }));
      return "Added to the queue.";
    },
  );
}

const statusSchema = z.object({
  id: uuid(),
  status: z.enum(["waiting", "with_nurse", "done"]),
});

/** Moves a patient along the queue; visits are opened and closed by the clinician. */
export async function setQueueStatus(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: FRONT_DESK, schema: statusSchema, revalidate: ["/queue", "/"] },
    async (d, { supabase }) => {
      const updated = must(
        await supabase
          .from("queue_entries")
          .update({ status: d.status })
          .eq("id", d.id)
          .is("encounter_id", null)
          .neq("status", "done")
          .select("id"),
      );
      if (updated.length === 0)
        throw new ActionError("This patient is already with a clinician or has left.");
      return d.status === "done" ? "Removed from the queue." : "Queue updated.";
    },
  );
}

/**
 * Records vitals at intake or during a visit (Clinician and Nurse, CLN-01). The id
 * comes from the form, so a retried save never records the same vitals twice.
 */
export async function recordVitals(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: CLINICAL, schema: vitalsSchema, revalidate: ["/queue", "/encounters", "/patients"] },
    async (d, { supabase, member }) => {
      const exists = await supabase.from("vitals").select("id").eq("id", d.id).maybeSingle();
      if (exists.data) return "Vitals recorded.";
      must(await supabase.from("vitals").insert({ ...d, recorded_by: member.userId }));
      return "Vitals recorded.";
    },
  );
}

/** Opens the visit for a queued patient and goes to the encounter screen. */
export async function startVisit(_p: FormState, formData: FormData): Promise<FormState> {
  let id: string | null = null;
  const result = await runAction(
    formData,
    { roles: CLINICIAN, schema: z.object({ id: uuid() }), revalidate: ["/queue", "/"] },
    async (d, { supabase }) => {
      id = must(await supabase.rpc("start_encounter", { p_queue_entry_id: d.id }));
    },
  );
  if (id && result.status === "success") redirect(`/encounters/${id}`);
  return result;
}
