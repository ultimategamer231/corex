"use server";

import { z } from "zod";
import { ActionError, must, requiredText, runAction, uuid } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { REGISTRAR, type Role, TEACHING } from "@/lib/roles";

const STAFF: readonly Role[] = [...TEACHING, ...REGISTRAR];
const opts = <T>(schema: z.ZodType<T>, roles: readonly Role[] = STAFF) => ({
  roles,
  schema,
  revalidate: ["/grades"],
});

const assessmentSchema = z.object({
  offering_id: uuid(),
  name: requiredText("the assessment name", 60),
  weight_percent: z.coerce
    .number({ error: "Enter the weight" })
    .gt(0, "Use more than 0")
    .max(100, "Use at most 100"),
  max_score: z.coerce
    .number({ error: "Enter the maximum score" })
    .gt(0, "Use more than 0")
    .max(1000, "Use at most 1000"),
});

export async function addAssessment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(assessmentSchema), async (d, { supabase }) => {
    must(await supabase.from("assessments").insert(d));
    return `${d.name} added.`;
  });
}

export async function removeAssessment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(z.object({ id: uuid() })), async ({ id }, { supabase }) => {
    const { count, error } = await supabase
      .from("assessment_scores")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", id);
    if (error) throw new ActionError(error.message);
    if (count)
      throw new ActionError("This assessment already has scores, so it cannot be removed.");
    must(await supabase.from("assessments").delete().eq("id", id));
    return "Assessment removed.";
  });
}

const scoresSchema = z.looseObject({ offering_id: uuid() });

/**
 * Saves the score sheet. Each cell carries the existing score's id or a new one made
 * when the sheet was drawn, so a retried save never duplicates (CORE-06). The
 * database refuses scores above the maximum and changes to submitted grades.
 */
export async function saveScores(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(scoresSchema, TEACHING), async (d, { supabase, member }) => {
    const values = d as Record<string, unknown>;
    const rows: {
      id: string;
      assessment_id: string;
      student_id: string;
      score: number;
      entered_by: string;
    }[] = [];
    for (const [key, raw] of Object.entries(values)) {
      if (!key.startsWith("score_") || typeof raw !== "string" || raw.trim() === "") continue;
      const [, assessmentId, studentId] = key.split("_");
      const id = values[`sid_${assessmentId}_${studentId}`];
      const score = Number(raw);
      if (!Number.isFinite(score) || score < 0)
        throw new ActionError(`"${raw}" is not a valid score.`);
      if (
        !z.uuid().safeParse(id).success ||
        !z.uuid().safeParse(assessmentId).success ||
        !z.uuid().safeParse(studentId).success
      ) {
        throw new ActionError("The score sheet is incomplete. Reload the page and try again.");
      }
      rows.push({
        id: id as string,
        assessment_id: assessmentId as string,
        student_id: studentId as string,
        score,
        entered_by: member.userId,
      });
    }
    if (rows.length === 0) throw new ActionError("Enter at least one score.");
    must(
      await supabase
        .from("assessment_scores")
        .upsert(rows, { onConflict: "assessment_id,student_id" }),
    );
    return `${rows.length} score${rows.length === 1 ? "" : "s"} saved.`;
  });
}

const offeringSchema = z.object({ offering_id: uuid() });

export async function submitGrades(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(offeringSchema), async (d, { supabase }) => {
    const n = must(await supabase.rpc("submit_grades", { p_offering_id: d.offering_id }));
    return `${n} grade${n === 1 ? "" : "s"} submitted to the Registrar.`;
  });
}

export async function approveGrades(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(offeringSchema, REGISTRAR), async (d, { supabase }) => {
    const n = must(await supabase.rpc("approve_grades", { p_offering_id: d.offering_id }));
    return `${n} grade${n === 1 ? "" : "s"} approved.`;
  });
}

export async function lockGrades(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(offeringSchema, REGISTRAR), async (d, { supabase }) => {
    const n = must(await supabase.rpc("lock_grades", { p_offering_id: d.offering_id }));
    return `${n} grade${n === 1 ? "" : "s"} locked and published.`;
  });
}

const reopenSchema = z.object({ offering_id: uuid(), reason: requiredText("a reason", 500) });

export async function reopenGrades(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(reopenSchema, REGISTRAR), async (d, { supabase }) => {
    const n = must(
      await supabase.rpc("reopen_grades", { p_offering_id: d.offering_id, p_reason: d.reason }),
    );
    return `${n} grade${n === 1 ? "" : "s"} reopened for changes.`;
  });
}

// High School: scores per section subject and marking period (SPEC.md 7.4) ------------

const hsScoresSchema = z.looseObject({ section_subject_id: uuid(), marking_period_id: uuid() });

/**
 * Saves a High School score sheet for one marking period. Each cell carries the
 * existing score's id or a new one made when the sheet was drawn, so a retried save
 * never duplicates (CORE-06). The database refuses changes to submitted scores.
 */
export async function saveHsScores(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(hsScoresSchema, ["teacher"]), async (d, { supabase, member }) => {
    const values = d as Record<string, unknown>;
    const toInsert: {
      id: string;
      student_id: string;
      section_subject_id: string;
      marking_period_id: string;
      score: number;
      entered_by: string;
    }[] = [];
    const toUpdate: { id: string; score: number }[] = [];
    for (const [key, raw] of Object.entries(values)) {
      if (!key.startsWith("score_") || typeof raw !== "string" || raw.trim() === "") continue;
      const studentId = key.slice("score_".length);
      const id = values[`sid_${studentId}`];
      const existing = values[`old_${studentId}`];
      const score = Number(raw);
      if (!Number.isFinite(score) || score < 0 || score > 100)
        throw new ActionError(`"${raw}" is not a score from 0 to 100.`);
      if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(studentId).success) {
        throw new ActionError("The score sheet is incomplete. Reload the page and try again.");
      }
      if (typeof existing === "string" && existing !== "") {
        if (Number(existing) !== score) toUpdate.push({ id: id as string, score });
      } else {
        toInsert.push({
          id: id as string,
          student_id: studentId,
          section_subject_id: d.section_subject_id,
          marking_period_id: d.marking_period_id,
          score,
          entered_by: member.userId,
        });
      }
    }
    if (toInsert.length + toUpdate.length === 0) return "Nothing changed.";
    if (toInsert.length) {
      must(
        await supabase
          .from("period_scores")
          .upsert(toInsert, { onConflict: "id", ignoreDuplicates: true }),
      );
    }
    for (const u of toUpdate)
      must(await supabase.from("period_scores").update({ score: u.score }).eq("id", u.id));
    const n = toInsert.length + toUpdate.length;
    return `${n} score${n === 1 ? "" : "s"} saved.`;
  });
}

const periodSchema = z.object({ section_subject_id: uuid(), marking_period_id: uuid() });

export async function submitPeriod(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(periodSchema), async (d, { supabase }) => {
    const n = must(
      await supabase.rpc("submit_period_scores", {
        p_section_subject_id: d.section_subject_id,
        p_marking_period_id: d.marking_period_id,
      }),
    );
    return `${n} score${n === 1 ? "" : "s"} submitted to the Registrar.`;
  });
}

export async function approvePeriod(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(periodSchema, REGISTRAR), async (d, { supabase }) => {
    const n = must(
      await supabase.rpc("approve_period_scores", {
        p_section_subject_id: d.section_subject_id,
        p_marking_period_id: d.marking_period_id,
      }),
    );
    return `${n} score${n === 1 ? "" : "s"} approved.`;
  });
}

export async function lockPeriod(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(periodSchema, REGISTRAR), async (d, { supabase }) => {
    const n = must(
      await supabase.rpc("lock_period_scores", {
        p_section_subject_id: d.section_subject_id,
        p_marking_period_id: d.marking_period_id,
      }),
    );
    return `${n} score${n === 1 ? "" : "s"} locked and published.`;
  });
}

export async function reopenPeriod(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    opts(periodSchema.extend({ reason: requiredText("a reason", 500) }), REGISTRAR),
    async (d, { supabase }) => {
      const n = must(
        await supabase.rpc("reopen_period_scores", {
          p_section_subject_id: d.section_subject_id,
          p_marking_period_id: d.marking_period_id,
          p_reason: d.reason,
        }),
      );
      return `${n} score${n === 1 ? "" : "s"} reopened for changes.`;
    },
  );
}
