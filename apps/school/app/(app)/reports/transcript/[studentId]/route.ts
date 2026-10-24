import { renderTranscriptPdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import { requireEdition } from "@/lib/edition";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { letterhead, pdfResponse } from "@/lib/pdf";
import { formatGpa, loadStudentRecord, resultRows } from "@/lib/transcript";

/** Transcript PDF: all terms with GPA, CGPA and credits earned (SPEC.md 7.3, SCH-08). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  requireEdition("college");
  if (!isUuid(studentId)) notFound();
  const { student, heading, record, creditsRequired } = await loadStudentRecord(studentId);
  const settings = await getSettings();
  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const documentNumber = `TR-${student.student_number}-${stamp}`;
  const pdf = await renderTranscriptPdf({
    org: await letterhead(),
    timezone: settings.timezone,
    documentNumber,
    student: heading,
    terms: record.terms.map((t) => ({
      name: t.termName,
      rows: resultRows(t.records, record.superseded),
      gpa: formatGpa(t.gpa),
      creditsEarned: t.creditsEarned,
    })),
    cgpa: formatGpa(record.cgpa),
    creditsEarned: record.creditsEarned,
    creditsRequired,
    generatedAt,
  });
  return pdfResponse(pdf, `${documentNumber}.pdf`);
}
