import { type GradeRecord, academicRecord, parseRepeatPolicy } from "./gpa";
import { getSettings } from "./org";
import type { SchoolDb } from "./supabase";

/** Published (locked) results of one student, ready for GPA and transcripts. */
export async function loadGradeRecords(db: SchoolDb, studentId: string): Promise<GradeRecord[]> {
  const [grades, scale] = await Promise.all([
    db
      .from("final_grades")
      .select(
        "numeric_score, letter, grade_points, course_offerings(term_id, course_id, courses(code, title, credits), terms(name, starts_on, academic_years(name)))",
      )
      .eq("student_id", studentId)
      .eq("status", "locked"),
    db.from("grade_scale").select("letter, is_passing"),
  ]);
  if (grades.error) throw new Error(grades.error.message);
  if (scale.error) throw new Error(scale.error.message);
  const passing = new Map(scale.data.map((g) => [g.letter, g.is_passing]));
  return grades.data.flatMap((g) => {
    const o = g.course_offerings;
    if (!o?.courses || !o.terms) return [];
    return [
      {
        courseId: o.course_id,
        code: o.courses.code,
        title: o.courses.title,
        credits: o.courses.credits,
        termId: o.term_id,
        termName: o.terms.academic_years
          ? `${o.terms.academic_years.name} ${o.terms.name}`
          : o.terms.name,
        termStartsOn: o.terms.starts_on,
        numericScore: g.numeric_score === null ? null : Number(g.numeric_score).toFixed(2),
        letter: g.letter,
        gradePoints: g.grade_points === null ? null : Number(g.grade_points).toFixed(2),
        isPassing: g.letter ? (passing.get(g.letter) ?? false) : false,
      },
    ];
  });
}

/** A student's term-by-term record under the school's repeat policy. */
export async function loadAcademicRecord(db: SchoolDb, studentId: string) {
  const [records, settings] = await Promise.all([loadGradeRecords(db, studentId), getSettings()]);
  return academicRecord(records, parseRepeatPolicy(settings.config.repeat_policy));
}
