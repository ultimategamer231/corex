"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, must, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
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

const vitalsSchema = z
  .object({
    id: z.uuid(),
    patient_id: uuid(),
    encounter_id: z
      .string()
      .optional()
      .transform((v) => v || null),
    temperature_c: z.string().optional(),
    pulse_bpm: z.string().optional(),
    bp_systolic: z.string().optional(),
    bp_diastolic: z.string().optional(),
    resp_rate: z.string().optional(),
    spo2: z.string().optional(),
    weight_kg: z.string().optional(),
    height_cm: z.string().optional(),
  })
  .transform((d, ctx) => {
    const ranges = {
      temperature_c: [30, 45, 1, "Temperature"],
      pulse_bpm: [20, 250, 0, "Pulse"],
      bp_systolic: [50, 260, 0, "Systolic pressure"],
      bp_diastolic: [30, 160, 0, "Diastolic pressure"],
      resp_rate: [4, 80, 0, "Breathing rate"],
      spo2: [50, 100, 0, "Oxygen saturation"],
      weight_kg: [0.5, 400, 1, "Weight"],
      height_cm: [20, 250, 1, "Height"],
    } as const;
    const out: Record<string, number | null> = {};
    for (const [key, [min, max, decimals, label]] of Object.entries(ranges)) {
      const raw = (d[key as keyof typeof ranges] ?? "").trim();
      if (!raw) {
        out[key] = null;
        continue;
      }
      const n = Number(raw);
      const pattern = decimals ? /^\d+(\.\d)?$/ : /^\d+$/;
      if (!pattern.test(raw) || n < min || n > max) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${label} must be between ${min} and ${max}`,
        });
      }
      out[key] = n;
    }
    if ((out.bp_systolic === null) !== (out.bp_diastolic === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["bp_diastolic"],
        message: "Enter both blood pressure numbers",
      });
    }
    if (Object.values(out).every((v) => v === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["temperature_c"],
        message: "Enter at least one measurement",
      });
    }
    return { id: d.id, patient_id: d.patient_id, encounter_id: d.encounter_id, ...out };
  });

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
