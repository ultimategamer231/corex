"use server";

import { z } from "zod";
import { ActionError, found, must, optionalText, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { CLINICIAN } from "@/lib/roles";

const revalidate = ["/encounters", "/patients", "/queue", "/"];

const noteSchema = z.object({
  encounter_id: uuid(),
  note_id: z
    .string()
    .optional()
    .transform((v) => v || null),
  complaints: optionalText,
  history: optionalText,
  examination: optionalText,
  assessment: optionalText,
  plan: optionalText,
  prescriptions_text: optionalText,
});

/** Saves the clinician's draft note for the visit; signed notes never change (CLN-03). */
export async function saveNote(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: CLINICIAN, schema: noteSchema, revalidate },
    async (d, { supabase }) => {
      const { encounter_id, note_id, ...content } = d;
      if (note_id) {
        const updated = must(
          await supabase
            .from("clinical_notes")
            .update(content)
            .eq("id", note_id)
            .is("signed_at", null)
            .select("id"),
        );
        if (updated.length === 0)
          throw new ActionError("Only your own unsigned draft can be changed.");
      } else {
        const open = found(
          await supabase.from("encounters").select("status").eq("id", encounter_id).maybeSingle(),
          "Visit not found.",
        );
        if (open.status !== "open") throw new ActionError("This visit is closed.");
        must(await supabase.from("clinical_notes").insert({ encounter_id, ...content }));
      }
      return "Draft saved.";
    },
  );
}

const idSchema = z.object({ id: uuid() });

export async function signNote(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: CLINICIAN, schema: idSchema, revalidate },
    async (d, { supabase }) => {
      must(await supabase.rpc("sign_note", { p_note_id: d.id }));
      return "Note signed. It can no longer be edited; add a correction if needed.";
    },
  );
}

/** A correction to a signed note: a new draft version that supersedes it (CLN-03). */
export async function amendNote(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: CLINICIAN, schema: idSchema, revalidate },
    async (d, { supabase }) => {
      must(await supabase.rpc("amend_note", { p_note_id: d.id }));
      return "Correction started as a new draft version. Edit and sign it below.";
    },
  );
}

export async function deleteDraft(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: CLINICIAN, schema: idSchema, revalidate },
    async (d, { supabase }) => {
      const deleted = must(
        await supabase
          .from("clinical_notes")
          .delete()
          .eq("id", d.id)
          .is("signed_at", null)
          .select("id"),
      );
      if (deleted.length === 0)
        throw new ActionError("Only your own unsigned draft can be deleted.");
      return "Draft deleted.";
    },
  );
}

export async function closeVisit(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: CLINICIAN, schema: idSchema, revalidate },
    async (d, { supabase }) => {
      must(await supabase.rpc("close_encounter", { p_encounter_id: d.id }));
      return "Visit closed. The cashier can now bill it.";
    },
  );
}
