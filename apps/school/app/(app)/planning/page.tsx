import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { configNumber } from "@corex/core/settings";
import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { date, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { currentTerm, rows, termLabel } from "@/lib/queries";
import { requireRoles } from "@/lib/session";
import { planCourse, submitPlan, unplanCourse } from "./actions";

export const metadata: Metadata = { title: "Course planning" };

const STATUS_BADGE = {
  planned: "info",
  submitted: "warning",
  approved: "brand",
  rejected: "danger",
  dropped: "neutral",
} as const;

export default async function PlanningPage() {
  const { supabase, member } = await requireRoles(["student"]);
  const settings = await getSettings();
  const { data: student, error } = await supabase
    .from("students")
    .select("id, student_number, program_enrollments(status, program_id, programs(code, name))")
    .eq("user_id", member.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const term = await currentTerm(supabase);
  if (!student || !term) {
    return (
      <>
        <PageHeader title="Course planning" />
        <EmptyState
          icon={<ListChecks />}
          title="Course planning is not available"
          description="Your student record or the current term is not set up yet. Ask the Registrar."
        />
      </>
    );
  }
  const enrollment = student.program_enrollments.find((e) => e.status === "active");
  const today = todayIso(settings.timezone);
  const open =
    term.registration_opens_on !== null &&
    term.registration_closes_on !== null &&
    today >= term.registration_opens_on &&
    today <= term.registration_closes_on;
  const maxCredits = configNumber(settings, "max_credits_per_term", 21);
  const minCredits = configNumber(settings, "min_credits_per_term", 12);

  const [registrations, offerings, seats, requirements, prerequisites, passed] = await Promise.all([
    supabase
      .from("course_registrations")
      .select(
        "id, status, decision_note, offering_id, course_offerings(term_id, course_id, section, courses(code, title, credits))",
      )
      .eq("student_id", student.id)
      .then(rows),
    supabase
      .from("course_offerings")
      .select("id, section, schedule_text, status, course_id, courses(code, title, credits)")
      .eq("term_id", term.id)
      .eq("status", "open")
      .then(rows),
    supabase.rpc("offering_seats", { p_term_id: term.id }).then(rows),
    enrollment
      ? supabase
          .from("program_requirements")
          .select("course_id, requirement_type, recommended_term, courses(code, title, credits)")
          .eq("program_id", enrollment.program_id)
          .then(rows)
      : [],
    supabase
      .from("course_prerequisites")
      .select(
        "course_id, prerequisite:courses!course_prerequisites_prerequisite_course_id_fkey(id, code)",
      )
      .then(rows),
    supabase
      .from("final_grades")
      .select("letter, course_offerings(course_id)")
      .eq("student_id", student.id)
      .then(rows),
  ]);
  const scale = rows(await supabase.from("grade_scale").select("letter, is_passing"));
  const passing = new Set(scale.filter((g) => g.is_passing).map((g) => g.letter));
  const passedCourses = new Set(
    passed
      .filter((g) => g.letter && passing.has(g.letter))
      .map((g) => g.course_offerings?.course_id),
  );
  const thisTerm = registrations.filter((r) => r.course_offerings?.term_id === term.id);
  const active = thisTerm.filter((r) => ["planned", "submitted", "approved"].includes(r.status));
  const inPlan = new Set(active.map((r) => r.course_offerings?.course_id));
  const credits = active.reduce((sum, r) => sum + (r.course_offerings?.courses?.credits ?? 0), 0);
  const planned = thisTerm.filter((r) => r.status === "planned");
  const submitted = thisTerm.some((r) => r.status === "submitted");
  const seatMap = new Map(seats.map((s) => [s.offering_id, s]));
  const prereqMap = new Map<string, string[]>();
  for (const p of prerequisites) {
    if (!p.prerequisite) continue;
    prereqMap.set(p.course_id, [...(prereqMap.get(p.course_id) ?? []), p.prerequisite.code]);
  }
  const missing = (courseId: string) =>
    prerequisites
      .filter(
        (p) => p.course_id === courseId && p.prerequisite && !passedCourses.has(p.prerequisite.id),
      )
      .map((p) => p.prerequisite?.code);
  offerings.sort((a, b) => (a.courses?.code ?? "").localeCompare(b.courses?.code ?? ""));
  requirements.sort((a, b) => (a.recommended_term ?? 99) - (b.recommended_term ?? 99));

  return (
    <>
      <PageHeader
        title="Course planning"
        description={`${termLabel(term)} · ${enrollment?.programs ? `${enrollment.programs.code} ${enrollment.programs.name}` : "No program"}`}
      />
      {open ? (
        <Alert tone="info" className="mb-6">
          Registration is open until {date(term.registration_closes_on, settings.timezone)}. Plan
          between {minCredits} and {maxCredits} credits, then submit your plan to the Registrar.
        </Alert>
      ) : (
        <Alert tone="warning" className="mb-6">
          Registration for this term is closed. Ask the Registrar to add or drop courses.
        </Alert>
      )}
      <div className="flex flex-col gap-8">
        <Section
          title="My plan"
          id="plan"
          description={`${credits} of ${maxCredits} credits`}
          actions={
            // Stays mounted after submitting so the result (and any credit warning) stays visible.
            <ActionForm
              action={submitPlan}
              aria-label="Submit my plan"
              className="gap-2"
              resetOnSuccess={false}
            >
              {open && planned.length > 0 && !submitted ? (
                <>
                  <input type="hidden" name="term_id" value={term.id} />
                  <SubmitButton variant="accent" pendingLabel="Submitting...">
                    Submit plan to the Registrar
                  </SubmitButton>
                </>
              ) : null}
            </ActionForm>
          }
        >
          {submitted ? (
            <Alert tone="info">
              Your plan is with the Registrar. You can change it only if the Registrar returns it.
            </Alert>
          ) : null}
          {thisTerm.length === 0 ? (
            <p className="text-muted">No courses yet. Add courses from the list below.</p>
          ) : (
            <TableScroll label="My plan">
              <Table>
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Credits</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {thisTerm.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <span className="font-semibold">{r.course_offerings?.courses?.code}</span>{" "}
                        {r.course_offerings?.courses?.title} (section {r.course_offerings?.section})
                        {r.decision_note ? (
                          <p className="text-sm text-muted">Registrar: {r.decision_note}</p>
                        ) : null}
                      </Td>
                      <Td>{r.course_offerings?.courses?.credits}</Td>
                      <Td>
                        <Badge
                          variant={STATUS_BADGE[r.status as keyof typeof STATUS_BADGE] ?? "neutral"}
                        >
                          {r.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {r.status === "planned" && open ? (
                          <ConfirmAction
                            action={unplanCourse}
                            fields={{ registration_id: r.id }}
                            triggerLabel="Remove"
                            title={`Remove ${r.course_offerings?.courses?.code ?? "this course"} from your plan?`}
                            description="You can add it again while registration is open."
                            confirmLabel="Remove"
                          />
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>

        <Section title="Courses offered this term" id="offered">
          {offerings.length === 0 ? (
            <p className="text-muted">No open courses this term.</p>
          ) : (
            <TableScroll label="Courses offered this term">
              <Table>
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Credits</Th>
                    <Th>Seats left</Th>
                    <Th>Prerequisites</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((o) => {
                    const seat = seatMap.get(o.id);
                    const left = seat ? seat.capacity - seat.taken : null;
                    const needs = missing(o.course_id);
                    const done = passedCourses.has(o.course_id);
                    return (
                      <tr key={o.id}>
                        <Td>
                          <span className="font-semibold">{o.courses?.code}</span>{" "}
                          {o.courses?.title} (section {o.section})
                          {o.schedule_text ? (
                            <p className="text-sm text-muted">{o.schedule_text}</p>
                          ) : null}
                        </Td>
                        <Td>{o.courses?.credits}</Td>
                        <Td>{left === null ? "-" : left}</Td>
                        <Td>
                          {(prereqMap.get(o.course_id) ?? []).join(", ") || "None"}
                          {needs.length ? (
                            <p className="text-sm font-medium text-danger">
                              Not yet passed: {needs.join(", ")}
                            </p>
                          ) : null}
                        </Td>
                        <Td className="text-right">
                          {done ? (
                            <Badge variant="brand">Passed</Badge>
                          ) : inPlan.has(o.course_id) ? (
                            <Badge variant="info">In your plan</Badge>
                          ) : open && !submitted ? (
                            <ActionForm
                              action={planCourse}
                              aria-label={`Add ${o.courses?.code ?? "course"} to my plan`}
                              className="items-end gap-2"
                            >
                              <input type="hidden" name="offering_id" value={o.id} />
                              <SubmitButton variant="secondary" size="sm" pendingLabel="Adding...">
                                Add<span className="sr-only"> {o.courses?.code}</span>
                              </SubmitButton>
                            </ActionForm>
                          ) : null}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>

        <Section title="Program requirements" id="requirements">
          {requirements.length === 0 ? (
            <p className="text-muted">Your program has no listed requirements.</p>
          ) : (
            <TableScroll label="Program requirements">
              <Table>
                <thead>
                  <tr>
                    <Th>Term</Th>
                    <Th>Course</Th>
                    <Th>Credits</Th>
                    <Th>Type</Th>
                    <Th>Progress</Th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r) => {
                    const progress = passedCourses.has(r.course_id)
                      ? "Passed"
                      : registrations.some(
                            (x) =>
                              x.course_offerings?.course_id === r.course_id &&
                              x.status === "approved",
                          )
                        ? "In progress"
                        : inPlan.has(r.course_id)
                          ? "Planned"
                          : "Not taken";
                    return (
                      <tr key={r.course_id}>
                        <Td>{r.recommended_term ?? "-"}</Td>
                        <Td>
                          <span className="font-semibold">{r.courses?.code}</span>{" "}
                          {r.courses?.title}
                        </Td>
                        <Td>{r.courses?.credits}</Td>
                        <Td>{r.requirement_type}</Td>
                        <Td>
                          <Badge
                            variant={
                              progress === "Passed"
                                ? "brand"
                                : progress === "Not taken"
                                  ? "neutral"
                                  : "info"
                            }
                          >
                            {progress}
                          </Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
      </div>
    </>
  );
}
