import { Badge } from "@corex/ui/components/badge";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { date, personName } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { currentTerm, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { requireEdition } from "@/lib/edition";
import { approveAll, decide, returnPlan } from "./actions";

export const metadata: Metadata = { title: "Registration" };

/** Plans shown per page; each plan lists its courses. */
const PLANS_PER_PAGE = 10;

type Props = { searchParams: Promise<{ page?: string }> };

export default async function RegistrationPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(REGISTRAR);
  const page = pageFrom((await searchParams).page);
  requireEdition("college");
  const settings = await getSettings();
  const term = await currentTerm(supabase);
  if (!term) {
    return (
      <>
        <PageHeader title="Registration" />
        <p className="text-muted">Set a current term first.</p>
      </>
    );
  }
  const [submitted, seats] = await Promise.all([
    supabase
      .from("course_registrations")
      .select(
        "id, submitted_at, student_id, offering_id, students(id, student_number, first_name, middle_name, last_name), course_offerings!inner(term_id, section, courses(code, title, credits))",
      )
      .eq("status", "submitted")
      .eq("course_offerings.term_id", term.id)
      .order("submitted_at")
      .then(rows),
    supabase.rpc("offering_seats", { p_term_id: term.id }).then(rows),
  ]);
  const seatMap = new Map(seats.map((s) => [s.offering_id, s]));
  const byStudent = new Map<string, typeof submitted>();
  for (const r of submitted)
    byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r]);

  return (
    <>
      <PageHeader
        title="Registration"
        description={`${termLabel(term)} · ${byStudent.size} plan${byStudent.size === 1 ? "" : "s"} waiting · registration ${
          term.registration_opens_on
            ? `${date(term.registration_opens_on, settings.timezone)} to ${date(term.registration_closes_on, settings.timezone)}`
            : "dates not set"
        }`}
      />
      {byStudent.size === 0 ? (
        <EmptyState
          icon={<ClipboardCheck />}
          title="No plans waiting"
          description="Submitted course plans appear here for approval."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...byStudent.entries()]
            .slice((page - 1) * PLANS_PER_PAGE, page * PLANS_PER_PAGE)
            .map(([studentId, regs]) => {
              const s = regs[0]?.students;
              const credits = regs.reduce(
                (sum, r) => sum + (r.course_offerings.courses?.credits ?? 0),
                0,
              );
              return (
                <section
                  key={studentId}
                  aria-labelledby={`plan-${studentId}`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id={`plan-${studentId}`} className="text-lg font-bold">
                      {s ? (
                        <Link
                          className="inline-flex min-h-11 items-center text-primary underline"
                          href={`/students/${studentId}`}
                        >
                          {personName(s)}
                        </Link>
                      ) : null}{" "}
                      <span className="text-base font-normal text-muted">
                        {s?.student_number} · {credits} credits
                      </span>
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <ActionForm
                        action={approveAll}
                        aria-label="Approve all courses"
                        className="gap-2"
                      >
                        {regs.map((r) => (
                          <input key={r.id} type="hidden" name="registration_ids" value={r.id} />
                        ))}
                        <SubmitButton size="sm" pendingLabel="Approving...">
                          Approve all
                          <span className="sr-only"> for {s ? personName(s) : "this student"}</span>
                        </SubmitButton>
                      </ActionForm>
                      <ConfirmAction
                        action={returnPlan}
                        fields={{ student_id: studentId, term_id: term.id }}
                        triggerLabel="Return plan"
                        title="Return the plan to the student?"
                        description="The student can change the plan and submit it again."
                        confirmLabel="Return plan"
                        reasonLabel="Note to the student"
                        reasonRequired={false}
                        variant="primary"
                      />
                    </div>
                  </div>
                  <TableScroll label={`Plan of ${s ? personName(s) : "student"}`}>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Course</Th>
                          <Th>Credits</Th>
                          <Th>Seats taken</Th>
                          <Th>
                            <span className="sr-only">Decision</span>
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {regs.map((r) => {
                          const seat = seatMap.get(r.offering_id);
                          const full = seat ? seat.taken >= seat.capacity : false;
                          const code = r.course_offerings.courses?.code ?? "course";
                          return (
                            <tr key={r.id}>
                              <Td>
                                <span className="font-semibold">{code}</span>{" "}
                                {r.course_offerings.courses?.title} (section{" "}
                                {r.course_offerings.section})
                              </Td>
                              <Td>{r.course_offerings.courses?.credits}</Td>
                              <Td>
                                {seat ? `${seat.taken} of ${seat.capacity}` : "-"}{" "}
                                {full ? <Badge variant="danger">Full</Badge> : null}
                              </Td>
                              <Td className="text-right whitespace-nowrap">
                                <div className="flex justify-end gap-2">
                                  <ActionForm
                                    action={decide}
                                    aria-label={`Approve ${code}`}
                                    className="gap-2"
                                  >
                                    <input type="hidden" name="registration_id" value={r.id} />
                                    <input type="hidden" name="decision" value="approve" />
                                    <SubmitButton variant="secondary" size="sm" pendingLabel="...">
                                      Approve<span className="sr-only"> {code}</span>
                                    </SubmitButton>
                                  </ActionForm>
                                  <ConfirmAction
                                    action={decide}
                                    fields={{ registration_id: r.id, decision: "reject" }}
                                    triggerLabel={`Reject ${code}`}
                                    title={`Reject ${code}?`}
                                    description="The student sees the course as rejected with your note."
                                    confirmLabel="Reject"
                                    reasonLabel="Note to the student"
                                    reasonRequired={false}
                                  />
                                </div>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </TableScroll>
                </section>
              );
            })}
          <Pagination
            page={page}
            total={byStudent.size}
            pageSize={PLANS_PER_PAGE}
            hrefFor={(p) => `/registration?page=${p}`}
          />
        </div>
      )}
    </>
  );
}
