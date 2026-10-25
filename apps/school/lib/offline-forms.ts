// Forms that also work offline (SPEC.md 10.1, School): class registers, and scores for
// students who have none yet. Offline, the form is checked with the same rules as the
// server and kept on the device; the sync action stores it when the connection is back.
import type { z } from "zod";
import { hsScoresForm, registerForm, scoresForm } from "./schemas";

export type OfflineForm = {
  table: string;
  schema: z.ZodType;
  /** Message after saving on the device. */
  saved: (raw: Record<string, unknown>) => string;
  /** Largest file kept on the device with the record; no files when unset. */
  maxFileBytes?: number;
  /** Keep the values after saving (a register or score sheet), instead of clearing the form. */
  keepValues?: boolean;
};

const NEW_ONLY = "Changes to scores already saved need a connection.";

export const OFFLINE_FORMS = {
  attendance: {
    table: "attendance",
    schema: registerForm,
    keepValues: true,
    saved: () => "Register saved on this device. It is recorded when you are back online.",
  },
  scores: {
    table: "assessment_scores",
    schema: scoresForm,
    keepValues: true,
    saved: () => `New scores saved on this device. They sync when you are back online. ${NEW_ONLY}`,
  },
  hs_scores: {
    table: "period_scores",
    schema: hsScoresForm,
    keepValues: true,
    saved: () => `New scores saved on this device. They sync when you are back online. ${NEW_ONLY}`,
  },
} satisfies Record<string, OfflineForm>;

export type OfflineFormName = keyof typeof OFFLINE_FORMS;
