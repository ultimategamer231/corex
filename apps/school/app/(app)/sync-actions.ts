"use server";

import { AuthError, requireMember, SESSION_HOURS } from "@corex/core/auth";
import { type ItemHandler, receiveOutboxItem, SyncError } from "@corex/core/offline/server";
import type { SyncResponse } from "@corex/core/offline/transport";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { dbMessage, demoWriteAllowed } from "@/lib/action";
import { schoolEnv } from "@/lib/env";
import { todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { hasAnyRole, REGISTRAR, type Role, TEACHING } from "@/lib/roles";
import {
  collegeScoreRows,
  hsScoreRows,
  hsScoresSchema,
  registerEntries,
  registerSchema,
  scoresSchema,
} from "@/lib/schemas";
import { asAuthClient, getSupabase } from "@/lib/supabase";

/**
 * Stores one register or score sheet saved on a device while offline (SPEC.md 10.2).
 * The member's current access is checked for every item, so someone suspended while
 * offline cannot sync (OFF-03). Offline only creates: rows already stored, and scores
 * a student already has, are left as they are (OFF-02, SPEC.md 10.1).
 */
export async function syncOutbox(form: FormData): Promise<SyncResponse> {
  const supabase = await getSupabase();
  let roles: string[];
  let userId: string;
  try {
    const member = await requireMember(asAuthClient(supabase), {
      sessionHours: SESSION_HOURS.school,
    });
    roles = member.roles;
    userId = member.userId;
  } catch (error) {
    if (error instanceof AuthError) return { status: "error", message: error.message };
    throw error;
  }
  if (schoolEnv().demo && !(await demoWriteAllowed(supabase))) {
    return { status: "error", message: "Too many changes in a short time. Try again in a minute." };
  }

  const allowed = (needed: readonly Role[]) => {
    if (!hasAnyRole(roles, needed)) throw new SyncError("Your role cannot save this.");
  };
  const parse = <T>(schema: z.ZodType<T>, payload: unknown): T => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new SyncError(parsed.error.issues[0]?.message ?? "Some values are not valid.");
    }
    return parsed.data;
  };
  const rowsOf = <T>(build: () => T): T => {
    try {
      return build();
    } catch (error) {
      throw new SyncError(error instanceof Error ? error.message : "Some values are not valid.");
    }
  };
  const stored = (result: {
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
  }) => {
    if (result.error) throw new SyncError(dbMessage(result.error));
    return (result.data?.length ?? 0) > 0 ? ("created" as const) : ("exists" as const);
  };

  const handlers: Record<string, ItemHandler> = {
    attendance: async ({ payload }) => {
      allowed([...TEACHING, ...REGISTRAR]);
      const d = parse(registerSchema, payload);
      const settings = await getSettings();
      if (d.date > todayIso(settings.timezone)) {
        throw new SyncError("Attendance cannot be recorded for a future date.");
      }
      const entries = rowsOf(() => registerEntries(d)).map((r) => ({
        ...r,
        date: d.date,
        class_ref_type: d.class_ref_type,
        class_ref_id: d.class_id,
        recorded_by: userId,
      }));
      return stored(
        await supabase
          .from("attendance")
          .upsert(entries, {
            onConflict: "date,student_id,class_ref_type,class_ref_id",
            ignoreDuplicates: true,
          })
          .select("id"),
      );
    },
    assessment_scores: async ({ payload }) => {
      allowed(TEACHING);
      const d = parse(scoresSchema, payload);
      const rows = rowsOf(() => collegeScoreRows(d)).map((r) => ({ ...r, entered_by: userId }));
      return stored(
        await supabase
          .from("assessment_scores")
          .upsert(rows, { onConflict: "assessment_id,student_id", ignoreDuplicates: true })
          .select("id"),
      );
    },
    period_scores: async ({ payload }) => {
      allowed(["teacher"]);
      const d = parse(hsScoresSchema, payload);
      const rows = rowsOf(() => hsScoreRows(d)).inserts.map((r) => ({
        ...r,
        section_subject_id: d.section_subject_id,
        marking_period_id: d.marking_period_id,
        entered_by: userId,
      }));
      if (rows.length === 0) return "exists";
      return stored(
        await supabase
          .from("period_scores")
          .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
          .select("id"),
      );
    },
  };

  const result = await receiveOutboxItem(form, handlers);
  if (result.status === "created") revalidatePath("/", "layout");
  return result;
}
