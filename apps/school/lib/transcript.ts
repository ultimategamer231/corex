import type { CourseResultRow, StudentHeading } from "@corex/pdf";
import { notFound } from "next/navigation";
import { loadAcademicRecord } from "./academic";
import { personName } from "./format";
import { formatGpa, type GradeRecord } from "./gpa";
import { rows } from "./queries";
import { REGISTRAR } from "./roles";
import { memberHas, requireRoles } from "./session";

/**
 * A student's record for a transcript or grade report. The Registrar may print any
 * student's; a student only their own (SCH-07). Row-level security enforces the same.
 */
export async function loadStudentRecord(studentId: string) {
  const session = await requireRoles([...REGISTRAR, "student"]);
  const { supabase, member } = session;
  const student = await supabase
    .from("students")
    .select(
      "id, user_id, student_number, first_name, middle_name, last_name, program_enrollments(status, programs(code, name, total_credits_required))",
    )
    .eq("id", studentId)
    .maybeSingle()
    .then(rows);
  if (!student) notFound();
  if (!memberHas(member, REGISTRAR) && student.user_id !== member.userId) notFound();
  const enrollment =
    student.program_enrollments.find((e) => e.status === "active") ??
    student.program_enrollments[0];
  const heading: StudentHeading = {
    name: personName(student),
    studentNumber: student.student_number,
    program: enrollment?.programs ? `${enrollment.programs.code} ${enrollment.programs.name}` : "-",
  };
  const record = await loadAcademicRecord(supabase, student.id);
  return {
    student,
    heading,
    record,
    creditsRequired: enrollment?.programs?.total_credits_required ?? 0,
  };
}

export function resultRows(
  records: GradeRecord[],
  superseded: Set<GradeRecord>,
): CourseResultRow[] {
  return records.map((r) => ({
    code: r.code,
    title: r.title,
    credits: r.credits,
    score: r.numericScore,
    letter: r.letter,
    gradePoints: r.gradePoints,
    note: superseded.has(r) ? "Repeated later; not counted in CGPA" : null,
  }));
}

export { formatGpa };
