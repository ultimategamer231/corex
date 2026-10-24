import { renderGradeReportPdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import { requireEdition } from "@/lib/edition";
import { isUuid } from "@/lib/ids";
import { academicRecord, parseRepeatPolicy } from "@/lib/gpa";
import { getSettings } from "@/lib/org";
import { letterhead, pdfResponse } from "@/lib/pdf";
import { formatGpa, loadStudentRecord, resultRows } from "@/lib/transcript";

/** Semester grade report PDF; CGPA and credits count terms up to this one (SPEC.md 7.3). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string; termId: string }> },
) {
  const { studentId, termId } = await params;
  requireEdition("college");
  if (!isUuid(studentId) || !isUuid(termId)) notFound();
  const { student, heading, record } = await loadStudentRecord(studentId);
  const term = record.terms.find((t) => t.termId === termId);
  if (!term) notFound();
  const settings = await getSettings();
  const upToTerm = record.terms
    .filter((t) => t.termStartsOn <= term.termStartsOn)
    .flatMap((t) => t.records);
  const cumulative = academicRecord(upToTerm, parseRepeatPolicy(settings.config.repeat_policy));
  const documentNumber = `GR-${student.student_number}-${term.termStartsOn.replaceAll("-", "")}`;
  const pdf = await renderGradeReportPdf({
    org: await letterhead(),
    timezone: settings.timezone,
    documentNumber,
    student: heading,
    term: term.termName,
    rows: resultRows(term.records, new Set()),
    termGpa: formatGpa(term.gpa),
    cgpa: formatGpa(cumulative.cgpa),
    creditsEarned: cumulative.creditsEarned,
    generatedAt: new Date(),
  });
  return pdfResponse(pdf, `${documentNumber}.pdf`);
}
