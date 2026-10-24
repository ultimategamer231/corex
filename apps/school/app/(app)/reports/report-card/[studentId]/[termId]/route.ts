import { renderReportCardPdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import { type NextRequest } from "next/server";
import { formatScore } from "@/lib/averages";
import { requireEdition } from "@/lib/edition";
import { familyStudents, loadTermReport } from "@/lib/highschool";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { letterhead, pdfResponse } from "@/lib/pdf";
import { REGISTRAR } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";

/**
 * Report card PDF for a semester, or one marking period with ?period= (SPEC.md 7.4,
 * SCH-08). The Registrar prints any student's; students and parents only their own.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string; termId: string }> },
) {
  const { supabase, member } = await requireRoles([...REGISTRAR, "student", "parent"]);
  requireEdition("highschool");
  const { studentId, termId } = await params;
  const periodId = request.nextUrl.searchParams.get("period") ?? undefined;
  if (!isUuid(studentId) || !isUuid(termId) || (periodId !== undefined && !isUuid(periodId)))
    notFound();
  if (
    !memberHas(member, REGISTRAR) &&
    !(await familyStudents(supabase, member)).some((s) => s.id === studentId)
  )
    notFound();

  const report = await loadTermReport(supabase, studentId, termId, { onlyPeriodId: periodId });
  if (!report || (periodId && report.periods.length === 0)) notFound();
  const settings = await getSettings();
  let rank: string | null = null;
  if (settings.config.show_rank === true && !periodId) {
    const { data } = await supabase.rpc("student_rank", {
      p_student_id: studentId,
      p_term_id: termId,
    });
    const r = data?.[0];
    if (r) rank = `${r.rank} of ${r.out_of}`;
  }
  const period = periodId ? report.periods[0] : undefined;
  const documentNumber = `RC-${report.student.student_number}-${report.term.startsOn.replaceAll("-", "")}${period ? `-P${period.number}` : ""}`;
  const pdf = await renderReportCardPdf({
    org: await letterhead(),
    timezone: settings.timezone,
    documentNumber,
    student: {
      name: personName(report.student),
      studentNumber: report.student.student_number,
      gradeSection: report.gradeSection ?? "-",
      year: report.year,
    },
    period: period ? `${report.term.name}, ${period.name}` : report.term.name,
    columns: report.periods.map((p) => p.name),
    rows: report.subjects.map((s) => ({
      subject: s.subject,
      scores: report.periods.map((p) =>
        s.scores.has(p.id) ? (s.scores.get(p.id) ?? 0).toFixed(2) : null,
      ),
      average: formatScore(s.average),
      passed: s.passed,
    })),
    overallAverage: formatScore(report.overall),
    passMark: report.passMark,
    rank,
    attendance: report.attendance,
    generatedAt: new Date(),
  });
  return pdfResponse(pdf, `${documentNumber}.pdf`);
}
