"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, must, optionalText, requiredText, runAction, uuid } from "@/lib/action";
import { uploadPatientFile } from "@/lib/files";
import type { FormState } from "@/lib/form-state";
import { CLINICAL, FRONT_DESK } from "@/lib/roles";

const details = z
  .object({
    first_name: requiredText("the first name", 80),
    middle_name: optionalText,
    last_name: requiredText("the last name", 80),
    sex: z.enum(["female", "male"], { error: "Choose the sex" }),
    date_of_birth: z
      .string()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter the date of birth"),
    phone: optionalText,
    address: optionalText,
    next_of_kin_name: optionalText,
    next_of_kin_phone: optionalText,
    has_allergies: z.enum(["no", "yes"], { error: "Say whether the patient has allergies" }),
    allergy_notes: optionalText,
  })
  .refine((d) => d.has_allergies === "no" || d.allergy_notes, {
    path: ["allergy_notes"],
    message: "List the allergies",
  });

type Details = z.infer<typeof details>;

function patientRow(d: Details) {
  return {
    first_name: d.first_name,
    middle_name: d.middle_name,
    last_name: d.last_name,
    sex: d.sex,
    date_of_birth: d.date_of_birth,
    phone: d.phone,
    address: d.address,
    next_of_kin_name: d.next_of_kin_name,
    next_of_kin_phone: d.next_of_kin_phone,
    has_allergies: d.has_allergies === "yes",
    allergy_notes: d.has_allergies === "yes" ? d.allergy_notes : null,
  };
}

/**
 * Registers a patient. The id comes from the form so a retry never registers the
 * patient twice; the database numbers the patient and flags a possible duplicate
 * (same name and date of birth, or same phone), shown on the profile (CLN-08).
 */
export async function registerPatient(_p: FormState, formData: FormData): Promise<FormState> {
  let id: string | null = null;
  const result = await runAction(
    formData,
    {
      roles: FRONT_DESK,
      schema: z.intersection(z.object({ id: z.uuid() }), details),
      revalidate: ["/patients", "/"],
    },
    async (d, { supabase }) => {
      const existing = await supabase.from("patients").select("id").eq("id", d.id).maybeSingle();
      if (!existing.data)
        must(
          // The database numbers the patient on insert; the placeholder is replaced.
          await supabase
            .from("patients")
            .insert({ id: d.id, patient_number: "", ...patientRow(d) }),
        );
      id = d.id;
    },
  );
  if (id && result.status === "success") redirect(`/patients/${id}?registered=1`);
  return result;
}

export async function updatePatient(_p: FormState, formData: FormData): Promise<FormState> {
  let id: string | null = null;
  const result = await runAction(
    formData,
    {
      roles: FRONT_DESK,
      schema: z.intersection(z.object({ id: uuid() }), details),
      revalidate: ["/patients"],
    },
    async (d, { supabase }) => {
      const updated = must(
        await supabase.from("patients").update(patientRow(d)).eq("id", d.id).select("id"),
      );
      if (updated.length === 0) throw new ActionError("You do not have permission to do this.");
      id = d.id;
    },
  );
  if (id && result.status === "success") redirect(`/patients/${id}`);
  return result;
}

/** A PDF, JPG or PNG for the patient's record, for clinical staff only (CLN-06). */
export async function attachFile(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: CLINICAL, schema: z.object({ patient_id: uuid() }), revalidate: ["/patients"] },
    async (d, { supabase, formData: raw }) => {
      const file = raw.get("file");
      if (!(file instanceof File) || file.size === 0)
        throw new ActionError("Choose a file to attach.");
      await uploadPatientFile(supabase, file, d.patient_id);
      return `${file.name} attached.`;
    },
  );
}
