import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { cn } from "@corex/ui/lib/utils";
import { buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { formatScore, semesterAverage } from "@/lib/averages";
import { requireEdition } from "@/lib/edition";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { currentTerm, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { approvePeriod, lockPeriod, reopenPeriod, saveHsScores, submitPeriod } from "../../actions";
import { periodStatus, STATUS_BADGE } from "../../highschool";

export const metadata: Metadata = { title: "Subject scores" };

type Props = {
  params: Promise<{ sectionSubjectId: string }>;
  searchParams: Promise<{ period?: string }>;
};

export default async function SubjectScoresPage({ params, searchParams }: Props) {
  const { supabase, member } = await requireRoles([...REGISTRAR, "teacher"]);
  requireEdition("highschool");
  const { sectionSubjectId } = await params;
  if (!isUuid(sectionSubjectId)) notFound();
  const registrar = memberHas(member, REGISTRAR);
  const ss = await supabase
    .from("section_subjects")
    .select(
      "id, teacher_id, section_id, subjects(name), sections(name, academic_year_id, grade_levels(name))",
    )
    .eq("id", sectionSubjectId)
    .maybeSingle()
    .then(rows);
  if (!ss || (!registrar && ss.teacher_id !== member.userId)) notFound();
  const teaches = ss.teacher_id === member.userId;
  const term = await currentTerm(supabase);
  if (!term) return <PageHeader title="Subject scores" description="Set a current term first." />;

  const [periods, students, scores] = await Promise.all([
    supabase
      .from("marking_periods")
      .select("id, number, name, is_exam, weight")
      .eq("term_id", term.id)
      .order("number")
      .then(rows),
    supabase
      .from("student_placements")
      .select("student_id, students(student_number, first_name, middle_name, last_name)")
      .eq("section_id", ss.section_id)
      .then(rows),
    supabase
      .from("period_scores")
      .select("id, student_id, marking_period_id, score, status, marking_periods!inner(term_id)")
      .eq("section_subject_id", sectionSubjectId)
      .eq("marking_periods.term_id", term.id)
      .then(rows),
  ]);
  students.sort((a, b) => (a.students?.last_name ?? "").localeCompare(b.students?.last_name ?? ""));
  const wanted = (await searchParams).period;
  // Without ?period=, open the first period that is not locked yet: the one in progress.
  const period =
    periods.find((p) => p.id === wanted) ??
    periods.find(
      (p) => !scores.some((s) => s.marking_period_id === p.id && s.status === "locked"),
    ) ??
    periods[0];
  const title = `${ss.sections?.grade_levels?.name ?? ""} ${ss.sections?.name ?? ""} · ${ss.subjects?.name ?? ""}`;
  if (!period) {
    return (
      <>
        <PageHeader title={title} description={termLabel(term)} />
        <p className="text-muted">
          The current term has no marking periods yet. The Registrar adds them under Academics.
        </p>
      </>
    );
  }
  const inPeriod = scores.filter((s) => s.marking_period_id === period.id);
  const byStudent = new Map(inPeriod.map((s) => [s.student_id, s]));
  const status = periodStatus(
    inPeriod.map((s) => s.status),
    students.length,
  );
  const editable = !inPeriod.some((s) => s.status !== "draft");
  const fields = { section_subject_id: sectionSubjectId, marking_period_id: period.id };
  const periodsForAverage = periods.map((p) => ({
    id: p.id,
    number: p.number,
    name: p.name,
    isExam: p.is_exam,
    weight: p.weight,
  }));

  return (
    <>
      <PageHeader
        title={title}
        description={`${termLabel(term)} · ${students.length} students`}
        actions={
          <>
            {editable && (teaches || registrar) && inPeriod.length > 0 ? (
              <ConfirmAction
                action={submitPeriod}
                fields={fields}
                triggerLabel={`Submit ${period.name}`}
                triggerVariant="accent"
                triggerSize="md"
                title={`Submit ${period.name} scores?`}
                description="The Registrar reviews and approves them. Scores cannot change after submission unless the Registrar reopens them."
                confirmLabel="Submit scores"
                variant="primary"
              />
            ) : null}
            {registrar && status === "submitted" && !teaches ? (
              <ConfirmAction
                action={approvePeriod}
                fields={fields}
                triggerLabel={`Approve ${period.name}`}
                triggerVariant="primary"
                triggerSize="md"
                title={`Approve ${period.name} scores?`}
                description="Approved scores can then be locked and published."
                confirmLabel="Approve"
                variant="primary"
              />
            ) : null}
            {registrar && status === "approved" ? (
              <ConfirmAction
                action={lockPeriod}
                fields={fields}
                triggerLabel={`Lock ${period.name}`}
                triggerVariant="primary"
                triggerSize="md"
                title={`Lock ${period.name} scores?`}
                description="Locked scores are published to students and parents and appear on report cards. They cannot be edited unless reopened with a reason."
                confirmLabel="Lock scores"
                variant="primary"
              />
            ) : null}
            {registrar && !editable ? (
              <ConfirmAction
                action={reopenPeriod}
                fields={fields}
                triggerLabel={`Reopen ${period.name}`}
                triggerSize="md"
                title={`Reopen ${period.name} scores?`}
                description="Scores return to draft so the teacher can change them. The reason is kept in the audit log."
                confirmLabel="Reopen scores"
                reasonLabel="Reason"
              />
            ) : null}
          </>
        }
      />
      <nav aria-label="Marking periods" className="mb-6 flex flex-wrap gap-2">
        {periods.map((p) => (
          <Link
            key={p.id}
            href={`/grades/subject/${sectionSubjectId}?period=${p.id}`}
            aria-current={p.id === period.id ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: p.id === period.id ? "primary" : "secondary", size: "sm" }),
            )}
          >
            {p.name}
          </Link>
        ))}
      </nav>
      {registrar && teaches && status === "submitted" ? (
        <Alert tone="info" className="mb-6">
          You teach this subject, so another Registrar must approve its scores.
        </Alert>
      ) : null}
      {!editable ? (
        <Alert tone="info" className="mb-6">
          {period.name} scores are {status}. They cannot be changed
          {registrar ? " unless you reopen them" : ""}.
        </Alert>
      ) : null}
      <Section
        title={`${period.name} scores`}
        id="scores"
        description={
          <>
            Status{" "}
            <Badge variant={STATUS_BADGE[status as keyof typeof STATUS_BADGE] ?? "neutral"}>
              {status}
            </Badge>{" "}
            · scores from 0 to 100
          </>
        }
      >
        {students.length === 0 ? (
          <p className="text-muted">No students are placed in this section yet.</p>
        ) : (
          <ActionForm action={saveHsScores} aria-label="Score sheet" resetOnSuccess={false}>
            <input type="hidden" name="section_subject_id" value={sectionSubjectId} />
            <input type="hidden" name="marking_period_id" value={period.id} />
            <TableScroll label="Score sheet">
              <Table>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>{period.name}</Th>
                    <Th>Semester average so far</Th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => {
                    const name = st.students ? personName(st.students) : "";
                    const existing = byStudent.get(st.student_id);
                    const average = semesterAverage(
                      periodsForAverage,
                      scores
                        .filter((s) => s.student_id === st.student_id)
                        .map((s) => ({ markingPeriodId: s.marking_period_id, score: s.score })),
                    );
                    return (
                      <tr key={st.student_id}>
                        <Td>
                          <span className="font-semibold whitespace-nowrap">{name}</span>
                          <p className="text-sm text-muted">{st.students?.student_number}</p>
                        </Td>
                        <Td>
                          <input
                            type="hidden"
                            name={`sid_${st.student_id}`}
                            value={existing?.id ?? crypto.randomUUID()}
                          />
                          <input
                            type="hidden"
                            name={`old_${st.student_id}`}
                            value={existing ? String(Number(existing.score)) : ""}
                          />
                          <Input
                            name={`score_${st.student_id}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="0.01"
                            defaultValue={existing ? Number(existing.score) : ""}
                            disabled={!editable || !teaches}
                            aria-label={`${period.name} score for ${name}`}
                            className="w-28"
                          />
                        </Td>
                        <Td>{formatScore(average)}</Td>
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
        )}
      </Section>
    </>
  );
}
