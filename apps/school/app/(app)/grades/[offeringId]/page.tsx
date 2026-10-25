import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PendingSheets } from "@/components/pending";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { personName } from "@/lib/format";
import { requireEdition } from "@/lib/edition";
import { isUuid } from "@/lib/ids";
import { rows, termLabel } from "@/lib/queries";
import { REGISTRAR, TEACHING } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import {
  addAssessment,
  approveGrades,
  lockGrades,
  removeAssessment,
  reopenGrades,
  saveScores,
  submitGrades,
} from "../actions";

export const metadata: Metadata = { title: "Class grades" };

type Props = { params: Promise<{ offeringId: string }> };

export default async function OfferingGradesPage({ params }: Props) {
  const { supabase, member } = await requireRoles([...REGISTRAR, ...TEACHING]);
  requireEdition("college");
  const { offeringId } = await params;
  if (!isUuid(offeringId)) notFound();
  const registrar = memberHas(member, REGISTRAR);

  const { data: offering, error } = await supabase
    .from("course_offerings")
    .select(
      "id, section, instructor_id, courses(code, title, credits), terms(name, academic_years(name))",
    )
    .eq("id", offeringId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!offering || (!registrar && offering.instructor_id !== member.userId)) notFound();
  const teaches = offering.instructor_id === member.userId;

  const [assessments, classList, scores, finals] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, name, weight_percent, max_score")
      .eq("offering_id", offeringId)
      .order("created_at")
      .then(rows),
    supabase
      .from("course_registrations")
      .select("student_id, students(student_number, first_name, middle_name, last_name)")
      .eq("offering_id", offeringId)
      .eq("status", "approved")
      .then(rows),
    supabase
      .from("assessment_scores")
      .select("id, assessment_id, student_id, score, assessments!inner(offering_id)")
      .eq("assessments.offering_id", offeringId)
      .then(rows),
    supabase
      .from("final_grades")
      .select("student_id, numeric_score, letter, grade_points, status")
      .eq("offering_id", offeringId)
      .then(rows),
  ]);
  classList.sort((a, b) =>
    (a.students?.last_name ?? "").localeCompare(b.students?.last_name ?? ""),
  );
  const scoreMap = new Map(scores.map((s) => [`${s.assessment_id}_${s.student_id}`, s]));
  const finalMap = new Map(finals.map((f) => [f.student_id, f]));
  const statuses = new Set(finals.map((f) => f.status));
  const editable =
    !statuses.has("submitted") && !statuses.has("approved") && !statuses.has("locked");
  const weightTotal = assessments.reduce((sum, a) => sum + Number(a.weight_percent), 0);
  const code = offering.courses?.code ?? "this course";

  return (
    <>
      <PageHeader
        title={`${code} ${offering.courses?.title ?? ""}`}
        description={`Section ${offering.section} · ${offering.terms ? termLabel(offering.terms) : ""} · ${classList.length} students`}
        actions={
          <>
            {editable && (teaches || registrar) && finals.length > 0 ? (
              <ConfirmAction
                action={submitGrades}
                fields={{ offering_id: offeringId }}
                triggerLabel="Submit grades"
                triggerVariant="accent"
                triggerSize="md"
                title={`Submit grades for ${code}?`}
                description="The Registrar reviews and approves them. Scores cannot change after submission unless the Registrar reopens them."
                confirmLabel="Submit grades"
                variant="primary"
              />
            ) : null}
            {registrar && statuses.has("submitted") && !teaches ? (
              <ConfirmAction
                action={approveGrades}
                fields={{ offering_id: offeringId }}
                triggerLabel="Approve grades"
                triggerVariant="primary"
                triggerSize="md"
                title={`Approve grades for ${code}?`}
                description="Approved grades can then be locked and published to students."
                confirmLabel="Approve"
                variant="primary"
              />
            ) : null}
            {registrar && statuses.has("approved") ? (
              <ConfirmAction
                action={lockGrades}
                fields={{ offering_id: offeringId }}
                triggerLabel="Lock and publish"
                triggerVariant="primary"
                triggerSize="md"
                title={`Lock grades for ${code}?`}
                description="Locked grades are published to students and appear on transcripts. They cannot be edited unless reopened with a reason."
                confirmLabel="Lock grades"
                variant="primary"
              />
            ) : null}
            {registrar && !editable ? (
              <ConfirmAction
                action={reopenGrades}
                fields={{ offering_id: offeringId }}
                triggerLabel="Reopen"
                triggerSize="md"
                title={`Reopen grades for ${code}?`}
                description="Grades return to draft so the instructor can change scores. The reason is kept in the audit log."
                confirmLabel="Reopen grades"
                reasonLabel="Reason"
              />
            ) : null}
          </>
        }
      />
      {registrar && teaches && statuses.has("submitted") ? (
        <Alert tone="info" className="mb-6">
          You teach this course, so another Registrar must approve its grades.
        </Alert>
      ) : null}
      {!editable ? (
        <Alert tone="info" className="mb-6">
          Grades are {[...statuses].join(", ")}. Scores cannot be changed
          {registrar ? " unless you reopen them" : ""}.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-8">
        <Section
          title="Assessments"
          id="assessments"
          description={`Weights add up to ${weightTotal}%${weightTotal === 100 ? "" : "; they must total 100% before grades can be submitted"}.`}
        >
          {assessments.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {assessments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pr-1 pl-3"
                >
                  <span>
                    <span className="font-semibold">{a.name}</span> · {Number(a.weight_percent)}% ·
                    out of {Number(a.max_score)}
                  </span>
                  {editable ? (
                    <ConfirmAction
                      action={removeAssessment}
                      fields={{ id: a.id }}
                      triggerLabel={`Remove ${a.name}`}
                      title={`Remove ${a.name}?`}
                      description="Only assessments without scores can be removed."
                      confirmLabel="Remove"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">
              No assessments yet. Add quizzes, assignments and exams with their weights.
            </p>
          )}
          {editable ? (
            <ActionForm action={addAssessment} aria-label="Add an assessment" className="max-w-3xl">
              <input type="hidden" name="offering_id" value={offeringId} />
              <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <FormField name="name" label="Assessment" required>
                  <Input placeholder="Midterm exam" />
                </FormField>
                <FormField name="weight_percent" label="Weight (%)" required>
                  <Input type="number" inputMode="decimal" min={1} max={100} step="0.01" />
                </FormField>
                <FormField name="max_score" label="Out of" required>
                  <Input type="number" inputMode="decimal" min={1} step="0.01" defaultValue={100} />
                </FormField>
                <SubmitButton variant="secondary">Add</SubmitButton>
              </div>
            </ActionForm>
          ) : null}
        </Section>

        <Section title="Scores" id="scores">
          {classList.length === 0 ? (
            <p className="text-muted">No students are registered in this class yet.</p>
          ) : assessments.length === 0 ? (
            <p className="text-muted">Add an assessment to enter scores.</p>
          ) : (
            <>
              <PendingSheets table="assessment_scores" label="Scores waiting to sync" />
              <ActionForm
                action={saveScores}
                aria-label="Score sheet"
                resetOnSuccess={false}
                offline="scores"
              >
                <input type="hidden" name="offering_id" value={offeringId} />
                <TableScroll label="Score sheet">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Student</Th>
                        {assessments.map((a) => (
                          <Th key={a.id}>
                            {a.name}
                            <span className="block text-xs font-normal text-muted">
                              out of {Number(a.max_score)}
                            </span>
                          </Th>
                        ))}
                        <Th>Score (%)</Th>
                        <Th>Grade</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {classList.map((c) => {
                        const name = c.students ? personName(c.students) : "";
                        const final = finalMap.get(c.student_id);
                        return (
                          <tr key={c.student_id}>
                            <Td>
                              <span className="font-semibold whitespace-nowrap">{name}</span>
                              <p className="text-sm text-muted">{c.students?.student_number}</p>
                            </Td>
                            {assessments.map((a) => {
                              const existing = scoreMap.get(`${a.id}_${c.student_id}`);
                              return (
                                <Td key={a.id}>
                                  <input
                                    type="hidden"
                                    name={`sid_${a.id}_${c.student_id}`}
                                    value={existing?.id ?? crypto.randomUUID()}
                                  />
                                  <Input
                                    name={`score_${a.id}_${c.student_id}`}
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    max={Number(a.max_score)}
                                    step="0.01"
                                    defaultValue={existing ? Number(existing.score) : ""}
                                    disabled={!editable || !teaches}
                                    aria-label={`${a.name} for ${name}`}
                                    className="w-24"
                                  />
                                </Td>
                              );
                            })}
                            <Td>
                              {final?.numeric_score === undefined || final.numeric_score === null
                                ? "-"
                                : Number(final.numeric_score).toFixed(2)}
                            </Td>
                            <Td className="font-bold">{final?.letter ?? "-"}</Td>
                            <Td>
                              {final ? (
                                <Badge
                                  variant={
                                    final.status === "locked"
                                      ? "brand"
                                      : final.status === "draft"
                                        ? "neutral"
                                        : "warning"
                                  }
                                >
                                  {final.status}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableScroll>
                {editable && teaches ? (
                  <div>
                    <SubmitButton pendingLabel="Saving scores...">Save scores</SubmitButton>
                  </div>
                ) : null}
              </ActionForm>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
