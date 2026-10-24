"use server";

import { z } from "zod";
import { ActionError, isoDate, must, requiredText, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { REGISTRAR, TEACHING } from "@/lib/roles";

const STATUS = z.enum(["present", "absent", "late", "excused"]);

const recordSchema = z.looseObject({
  class_id: uuid("a class"),
  class_ref_type: z.enum(["offering", "section"]),
  date: isoDate("the date"),
});

/**
 * Saves a class register. Each row has an id made when the form was drawn, so a
 * retried save never duplicates (CORE-06); students already recorded that day are
 * left as they are (corrections go to the Registrar).
 */
export async function recordAttendance(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: [...TEACHING, ...REGISTRAR], schema: recordSchema, revalidate: ["/attendance"] },
    async (d, { supabase, member }) => {
      const settings = await getSettings();
      if (d.date > todayIso(settings.timezone))
        throw new ActionError("Attendance cannot be recorded for a future date.");
      const entries = Object.entries(d)
        .filter(([key]) => key.startsWith("status_"))
        .map(([key, value]) => {
          const studentId = key.slice("status_".length);
          const id = (d as Record<string, unknown>)[`id_${studentId}`];
          const status = STATUS.safeParse(value);
          if (
            !z.uuid().safeParse(studentId).success ||
            !z.uuid().safeParse(id).success ||
            !status.success
          ) {
            throw new ActionError("The register is incomplete. Reload the page and try again.");
          }
          return {
            id: id as string,
            date: d.date,
            student_id: studentId,
            class_ref_type: d.class_ref_type,
            class_ref_id: d.class_id,
            status: status.data,
            recorded_by: member.userId,
          };
        });
      if (entries.length === 0) throw new ActionError("There are no students on this class list.");
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
  status: STATUS,
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
