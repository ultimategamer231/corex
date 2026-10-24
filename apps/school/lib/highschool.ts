import type { CurrentMember } from "@corex/core/auth";
import { configNumber } from "@corex/core/settings";
import { isComplete, type MarkingPeriod, overallAverage, semesterAverage } from "./averages";
import { personName } from "./format";
import { getSettings } from "./org";
import { rows, termLabel } from "./queries";
import { hasAnyRole } from "./roles";
import type { SchoolDb } from "./supabase";

export type StudentRef = {
  id: string;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

/**
 * Students the member sees as their own: a student's own record, a parent's linked
 * children (SPEC.md 7.5 portals). Row-level security returns nothing else.
 */
export async function familyStudents(db: SchoolDb, member: CurrentMember): Promise<StudentRef[]> {
  const columns = "id, student_number, first_name, middle_name, last_name";
  const out: StudentRef[] = [];
  if (hasAnyRole(member.roles, ["student"])) {
    out.push(...rows(await db.from("students").select(columns).eq("user_id", member.userId)));
  }
  if (hasAnyRole(member.roles, ["parent"])) {
    const links = rows(
      await db
        .from("student_guardians")
        .select(`students(${columns}), guardians!inner(user_id)`)
        .eq("guardians.user_id", member.userId),
    );
    for (const l of links)
      if (l.students && !out.some((s) => s.id === l.students?.id)) out.push(l.students);
  }
  return out;
}

export type SubjectResult = {
  sectionSubjectId: string;
  subject: string;
  /** Score per marking period id. */
  scores: Map<string, number>;
  average: number | null;
  complete: boolean;
  passed: boolean | null;
};

export type TermReport = {
  student: StudentRef;
  term: { id: string; name: string; label: string; startsOn: string; endsOn: string };
  year: string;
  gradeSection: string | null;
  sectionId: string | null;
  periods: MarkingPeriod[];
  subjects: SubjectResult[];
  overall: number | null;
  passMark: number;
  attendance: { present: number; absent: number; late: number; excused: number };
};

/**
 * One student's results for a term: every subject of their section with its period
 * scores and weighted average (SPEC.md 7.4). Only locked scores unless `includeDrafts`
 * (teacher and Registrar views); row-level security still limits what is read.
 */
export async function loadTermReport(
  db: SchoolDb,
  studentId: string,
  termId: string,
  options: { includeDrafts?: boolean; onlyPeriodId?: string } = {},
): Promise<TermReport | null> {
  const settings = await getSettings();
  const [student, term] = await Promise.all([
    db
      .from("students")
      .select("id, student_number, first_name, middle_name, last_name")
      .eq("id", studentId)
      .maybeSingle()
      .then(rows),
    db
      .from("terms")
      .select("id, name, starts_on, ends_on, academic_year_id, academic_years(name)")
      .eq("id", termId)
      .maybeSingle()
      .then(rows),
  ]);
  if (!student || !term) return null;
  const placement = await db
    .from("student_placements")
    .select("section_id, sections(name, grade_levels(name))")
    .eq("student_id", studentId)
    .eq("academic_year_id", term.academic_year_id)
    .maybeSingle()
    .then(rows);
  const sectionId = placement?.section_id ?? null;
  const [periodsRaw, subjects, scores, attendance] = await Promise.all([
    db
      .from("marking_periods")
      .select("id, number, name, is_exam, weight")
      .eq("term_id", termId)
      .order("number")
      .then(rows),
    sectionId
      ? db
          .from("section_subjects")
          .select("id, subjects(name)")
          .eq("section_id", sectionId)
          .then(rows)
      : [],
    db
      .from("period_scores")
      .select(
        "section_subject_id, marking_period_id, score, status, marking_periods!inner(term_id)",
      )
      .eq("student_id", studentId)
      .eq("marking_periods.term_id", termId)
      .then(rows),
    sectionId
      ? db
          .from("attendance")
          .select("status")
          .eq("student_id", studentId)
          .eq("class_ref_type", "section")
          .gte("date", term.starts_on)
          .lte("date", term.ends_on)
          .then(rows)
      : [],
  ]);
  const allPeriods: MarkingPeriod[] = periodsRaw.map((p) => ({
    id: p.id,
    number: p.number,
    name: p.name,
    isExam: p.is_exam,
    weight: p.weight,
  }));
  const periods = options.onlyPeriodId
    ? allPeriods.filter((p) => p.id === options.onlyPeriodId)
    : allPeriods;
  const passMark = configNumber(settings, "pass_mark", 70);
  const visible = scores.filter((s) => options.includeDrafts || s.status === "locked");
  const results: SubjectResult[] = subjects
    .map((ss) => {
      const own = visible
        .filter((s) => s.section_subject_id === ss.id)
        .map((s) => ({ markingPeriodId: s.marking_period_id, score: s.score }));
      const average = semesterAverage(periods, own);
      return {
        sectionSubjectId: ss.id,
        subject: ss.subjects?.name ?? "",
        scores: new Map(own.map((s) => [s.markingPeriodId, Number(s.score)])),
        average,
        complete: isComplete(periods, own),
        passed: average === null ? null : average >= passMark,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));
  const count = (status: string) => attendance.filter((a) => a.status === status).length;
  return {
    student,
    term: {
      id: term.id,
      name: term.name,
      label: termLabel(term),
      startsOn: term.starts_on,
      endsOn: term.ends_on,
    },
    year: term.academic_years?.name ?? "",
    gradeSection: placement?.sections
      ? `${placement.sections.grade_levels?.name ?? ""} ${placement.sections.name}`.trim()
      : null,
    sectionId,
    periods,
    subjects: results,
    overall: overallAverage(results.map((r) => r.average)),
    passMark,
    attendance: {
      present: count("present"),
      absent: count("absent"),
      late: count("late"),
      excused: count("excused"),
    },
  };
}

export function studentLabel(s: StudentRef): string {
  return `${personName(s)} (${s.student_number})`;
}
