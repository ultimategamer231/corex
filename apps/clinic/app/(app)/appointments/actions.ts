"use server";

import { redirect } from "next/navigation";
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
import { timeText, zonedInstant } from "@/lib/clinic";
import type { FormState } from "@/lib/form-state";
import { getSettings } from "@/lib/org";
import { FRONT_DESK } from "@/lib/roles";

const slot = z.object({
  clinician_id: uuid("the clinician"),
  date: isoDate("the date"),
  time: timeText("the time"),
  duration_minutes: z.coerce
    .number({ error: "Enter the length in minutes" })
    .int("Enter whole minutes")
    .min(5, "At least 5 minutes")
    .max(480, "At most 8 hours"),
});

/**
 * Books an appointment. A clash with the clinician's other bookings is refused by the
 * database, which serializes bookings per clinician (CLN-04).
 */
export async function bookAppointment(_p: FormState, formData: FormData): Promise<FormState> {
  let date: string | null = null;
  const result = await runAction(
    formData,
    {
      roles: FRONT_DESK,
      schema: slot.extend({ patient_id: uuid("the patient"), reason: optionalText }),
      revalidate: ["/appointments", "/"],
    },
    async (d, { supabase }) => {
      const { timezone } = await getSettings();
      must(
        await supabase.from("appointments").insert({
          patient_id: d.patient_id,
          clinician_id: d.clinician_id,
          starts_at: zonedInstant(d.date, d.time, timezone).toISOString(),
          duration_minutes: d.duration_minutes,
          reason: d.reason,
        }),
      );
      date = d.date;
    },
  );
  if (date && result.status === "success") redirect(`/appointments?date=${date}&booked=1`);
  return result;
}

export async function rescheduleAppointment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: FRONT_DESK, schema: slot.extend({ id: uuid() }), revalidate: ["/appointments", "/"] },
    async (d, { supabase }) => {
      const { timezone } = await getSettings();
      const updated = must(
        await supabase
          .from("appointments")
          .update({
            clinician_id: d.clinician_id,
            starts_at: zonedInstant(d.date, d.time, timezone).toISOString(),
            duration_minutes: d.duration_minutes,
          })
          .eq("id", d.id)
          .eq("status", "booked")
          .select("id"),
      );
      if (updated.length === 0) throw new ActionError("Only a booked appointment can be moved.");
      return "Appointment moved.";
    },
  );
}

/** Cancelled appointments stay in the history with their reason (CLN-05). */
export async function cancelAppointment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    {
      roles: FRONT_DESK,
      schema: z.object({ id: uuid(), reason: requiredText("a reason", 300) }),
      revalidate: ["/appointments", "/"],
    },
    async (d, { supabase }) => {
      const updated = must(
        await supabase
          .from("appointments")
          .update({ status: "cancelled", cancel_reason: d.reason })
          .eq("id", d.id)
          .eq("status", "booked")
          .select("id"),
      );
      if (updated.length === 0)
        throw new ActionError("Only a booked appointment can be cancelled.");
      return "Appointment cancelled.";
    },
  );
}

export async function markNoShow(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: FRONT_DESK, schema: z.object({ id: uuid() }), revalidate: ["/appointments", "/"] },
    async (d, { supabase }) => {
      const updated = must(
        await supabase
          .from("appointments")
          .update({ status: "no_show" })
          .eq("id", d.id)
          .eq("status", "booked")
          .select("id"),
      );
      if (updated.length === 0) throw new ActionError("Only a booked appointment can be marked.");
      return "Marked as no show.";
    },
  );
}

/** Puts the patient in the queue for the appointment. */
export async function checkIn(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    {
      roles: FRONT_DESK,
      schema: z.object({ id: uuid() }),
      revalidate: ["/appointments", "/queue", "/"],
    },
    async (d, { supabase }) => {
      must(await supabase.rpc("check_in", { p_appointment_id: d.id }));
      return "Checked in. The patient is in the queue.";
    },
  );
}
