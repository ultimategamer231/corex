// Class registers and score sheets, shared by the server actions and the offline forms
// (SPEC.md 10.1, School): a register or sheet saved on the device is checked with the
// same rules before and after sync. Errors carry a message the teacher can act on.
import { z } from "zod";
import { isoDate, uuid } from "./fields";

export const ATTENDANCE_STATUS = z.enum(["present", "absent", "late", "excused"]);

export const registerSchema = z.looseObject({
  class_id: uuid("a class"),
  class_ref_type: z.enum(["offering", "section"]),
  date: isoDate("the date"),
});

export type RegisterEntry = {
  id: string;
  student_id: string;
  status: z.infer<typeof ATTENDANCE_STATUS>;
};

/** One row per student on the register; each row's id was made when the form was drawn. */
export function registerEntries(values: Record<string, unknown>): RegisterEntry[] {
  const entries = Object.entries(values)
    .filter(([key]) => key.startsWith("status_"))
    .map(([key, value]) => {
      const studentId = key.slice("status_".length);
      const id = values[`id_${studentId}`];
      const status = ATTENDANCE_STATUS.safeParse(value);
      if (
        !z.uuid().safeParse(studentId).success ||
        !z.uuid().safeParse(id).success ||
        !status.success
      ) {
        throw new Error("The register is incomplete. Reload the page and try again.");
      }
      return { id: id as string, student_id: studentId, status: status.data };
    });
  if (entries.length === 0) throw new Error("There are no students on this class list.");
  return entries;
}

export const scoresSchema = z.looseObject({ offering_id: uuid() });

export type ScoreRow = { id: string; assessment_id: string; student_id: string; score: number };

/** College score sheet cells that have a score. */
export function collegeScoreRows(values: Record<string, unknown>): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!key.startsWith("score_") || typeof raw !== "string" || raw.trim() === "") continue;
    const [, assessmentId, studentId] = key.split("_");
    const id = values[`sid_${assessmentId}_${studentId}`];
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 0) throw new Error(`"${raw}" is not a valid score.`);
    if (
      !z.uuid().safeParse(id).success ||
      !z.uuid().safeParse(assessmentId).success ||
      !z.uuid().safeParse(studentId).success
    ) {
      throw new Error("The score sheet is incomplete. Reload the page and try again.");
    }
    rows.push({
      id: id as string,
      assessment_id: assessmentId as string,
      student_id: studentId as string,
      score,
    });
  }
  if (rows.length === 0) throw new Error("Enter at least one score.");
  return rows;
}

export const hsScoresSchema = z.looseObject({
  section_subject_id: uuid(),
  marking_period_id: uuid(),
});

export type HsScores = {
  inserts: { id: string; student_id: string; score: number }[];
  updates: { id: string; score: number }[];
};

/** High School sheet: new scores, and changed scores that were already saved. */
export function hsScoreRows(values: Record<string, unknown>): HsScores {
  const out: HsScores = { inserts: [], updates: [] };
  for (const [key, raw] of Object.entries(values)) {
    if (!key.startsWith("score_") || typeof raw !== "string" || raw.trim() === "") continue;
    const studentId = key.slice("score_".length);
    const id = values[`sid_${studentId}`];
    const existing = values[`old_${studentId}`];
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`"${raw}" is not a score from 0 to 100.`);
    }
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(studentId).success) {
      throw new Error("The score sheet is incomplete. Reload the page and try again.");
    }
    if (typeof existing === "string" && existing !== "") {
      if (Number(existing) !== score) out.updates.push({ id: id as string, score });
    } else {
      out.inserts.push({ id: id as string, student_id: studentId, score });
    }
  }
  return out;
}

/** A zod schema that also runs `rows` on the form, for checking a form before saving it offline. */
function withRows<T extends z.ZodType>(schema: T, rows: (v: Record<string, unknown>) => unknown) {
  return schema.superRefine((value, ctx) => {
    try {
      rows(value as Record<string, unknown>);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["form"],
        message: error instanceof Error ? error.message : "Some values are not valid.",
      });
    }
  });
}

export const registerForm = withRows(registerSchema, registerEntries);
export const scoresForm = withRows(scoresSchema, collegeScoreRows);
export const hsScoresForm = withRows(hsScoresSchema, (v) => {
  if (hsScoreRows(v).inserts.length === 0) throw new Error("Enter at least one new score.");
});
