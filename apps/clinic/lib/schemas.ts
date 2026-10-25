// Validation shared by the server actions and the offline forms (SPEC.md 10): a
// record saved on the device is checked with the same rules before and after sync.
import { z } from "zod";
import { optionalText, requiredText, uuid } from "./fields";

export const patientDetails = z
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

export type PatientDetails = z.infer<typeof patientDetails>;

export function patientRow(d: PatientDetails) {
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

/** A patient registered on this device; the id is made by the device. */
export const patientForm = z.intersection(z.object({ id: z.uuid() }), patientDetails);

export const vitalsSchema = z
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
