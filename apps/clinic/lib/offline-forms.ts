// Forms that also work offline (SPEC.md 10.1, Clinic): patient registration and vitals.
// Offline, the form is checked with the same rules as the server and kept on the
// device; the sync action stores it when the connection is back.
import type { z } from "zod";
import { personName } from "./format";
import { patientForm, vitalsSchema } from "./schemas";

export type OfflineForm = {
  table: string;
  schema: z.ZodType;
  /** Message after saving on the device. */
  saved: (raw: Record<string, unknown>) => string;
};

const text = (v: unknown) => (typeof v === "string" ? v : "");

export const OFFLINE_FORMS = {
  patients: {
    table: "patients",
    schema: patientForm,
    saved: (raw) =>
      `${personName({ first_name: text(raw.first_name), last_name: text(raw.last_name) })} is saved on this device and will be registered when you are back online.`,
  },
  vitals: {
    table: "vitals",
    schema: vitalsSchema,
    saved: () => "Vitals saved on this device. They sync when you are back online.",
  },
} satisfies Record<string, OfflineForm>;

export type OfflineFormName = keyof typeof OFFLINE_FORMS;
