"use server";

import { z } from "zod";
import { ActionError, must, requiredText, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import {
  ATTENDANCE_STATUS,
  type RegisterEntry,
  registerEntries,
  registerSchema,
} from "@/lib/schemas";
import { todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { REGISTRAR, TEACHING } from "@/lib/roles";

/**
 * Saves a class register. Each row has an id made when the form was drawn, so a
 * retried save never duplicates (CORE-06); students already recorded that day are
 * left as they are (corrections go to the Registrar).
 */
export async function recordAttendance(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: [...TEACHING, ...REGISTRAR], schema: registerSchema, revalidate: ["/attendance"] },
    async (d, { supabase, member }) => {
      const settings = await getSettings();
      if (d.date > todayIso(settings.timezone))
        throw new ActionError("Attendance cannot be recorded for a future date.");
      let rows: RegisterEntry[];
      try {
        rows = registerEntries(d);
      } catch (error) {
        throw new ActionError(
          error instanceof Error ? error.message : "The register is incomplete.",
        );
      }
      const entries = rows.map((r) => ({
        ...r,
        date: d.date,
        class_ref_type: d.class_ref_type,
        class_ref_id: d.class_id,
        recorded_by: member.userId,
      }));
      must(
        await supabase.from("attendance").upsert(entries, {
          onConflict: "date,student_id,class_ref_type,class_ref_id",
          ignoreDuplicates: true,
        }),
      );
      return `Attendance saved for ${entries.length} student${entries.length === 1 ? "" : "s"}.`;
    },
  );
}

const correctSchema = z.object({
  id: uuid(),
  status: ATTENDANCE_STATUS,
  reason: requiredText("a reason", 500),
});

export async function correctAttendance(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: REGISTRAR, schema: correctSchema, revalidate: ["/attendance"] },
    async (d, { supabase }) => {
      must(
        await supabase.rpc("correct_attendance", {
          p_id: d.id,
          p_status: d.status,
          p_reason: d.reason,
        }),
      );
      return "Attendance corrected.";
    },
  );
}
