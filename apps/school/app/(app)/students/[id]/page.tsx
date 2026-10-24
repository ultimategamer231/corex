import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { loadAcademicRecord } from "@/lib/academic";
import { formatScore } from "@/lib/averages";
import { edition } from "@/lib/edition";
import { loadTermReport } from "@/lib/highschool";
import { date, money, percent, personName } from "@/lib/format";
import { formatGpa } from "@/lib/gpa";
import { getSettings } from "@/lib/org";
import { currentTerm, listTerms, rows, termLabel } from "@/lib/queries";
import { BURSAR, OFFICE, REGISTRAR } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import {
  addGuardian,
  createParentLogin,
  createStudentLogin,
  enrollInProgram,
  placeStudent,
  registrarDrop,
  registrarRegister,
  updateStudent,
} from "../actions";

export const metadata: Metadata = { title: "Student" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ admitted?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage({ params, searchParams }: Props) {
  const { supabase, member } = await requireRoles(OFFICE);
  const { id } = await params;
  const { admitted } = await searchParams;
  if (!UUID.test(id)) notFound();
  const registrar = memberHas(member, REGISTRAR);
  const bursar = memberHas(member, BURSAR);
  const superAdmin = memberHas(member, ["super_admin"]);
  const college = edition() === "college";
  const settings = await getSettings();

  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!student) notFound();

  const [guardians, enrollments, registrations, programs, terms, term] = await Promise.all([
    supabase
      .from("student_guardians")
      .select(
        "is_primary, guardians(id, first_name, last_name, relationship, phone, email, user_id)",
      )
      .eq("student_id", id)
      .then(rows),
    supabase
      .from("program_enrollments")
      .select("id, status, created_at, programs(code, name), terms(name, academic_years(name))")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .then(rows),
    registrar && college
      ? supabase
          .from("course_registrations")
          .select(
            "id, status, decision_note, course_offerings(id, section, courses(code, title, credits), terms(name, starts_on, academic_years(name)))",
          )
          .eq("student_id", id)
          .then(rows)
      : [],
    college ? supabase.from("programs").select("id, code, name").order("code").then(rows) : [],
    listTerms(supabase),
    currentTerm(supabase),
  ]);

  const [record, attendance, balances, offerings, placements, sections] = await Promise.all([
    registrar && college ? loadAcademicRecord(supabase, id) : null,
    registrar ? supabase.from("attendance").select("status").eq("student_id", id).then(rows) : [],
    bursar
      ? supabase
          .from("student_balances")
          .select("currency, balance_minor")
          .eq("student_id", id)
          .then(rows)
      : [],
    registrar && term && college
      ? supabase
          .from("course_offerings")
          .select("id, section, courses(code, title)")
          .eq("term_id", term.id)
          .eq("status", "open")
          .then(rows)
      : [],
    college
      ? []
      : supabase
          .from("student_placements")
          .select(
            "id, academic_year_id, sections(id, name, grade_levels(name)), academic_years(name, starts_on)",
          )
          .eq("student_id", id)
          .then(rows),
    !college && registrar && term
      ? supabase
          .from("sections")
          .select("id, name, grade_levels(name, sort_order)")
          .eq("academic_year_id", term.academic_year_id)
          .then(rows)
      : [],
  ]);
  placements.sort((a, b) =>
    (b.academic_years?.starts_on ?? "").localeCompare(a.academic_years?.starts_on ?? ""),
  );
  sections.sort(
    (a, b) =>
      (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
      a.name.localeCompare(b.name),
  );
  const currentPlacement = term
    ? placements.find((p) => p.academic_year_id === term.academic_year_id)
    : undefined;
  const yearTerms =
    !college && term
      ? terms.filter((t) => t.academic_year_id === term.academic_year_id).reverse()
      : [];
  const termReports =
    !college && registrar
      ? await Promise.all(yearTerms.map((t) => loadTermReport(supabase, id, t.id)))
      : [];

  const activeEnrollment = enrollments.find((e) => e.status === "active");
  const sortedRegs = [...registrations].sort((a, b) =>
    (b.course_offerings?.terms?.starts_on ?? "").localeCompare(
      a.course_offerings?.terms?.starts_on ?? "",
    ),
  );
  const attended = attendance.filter((a) => a.status === "present" || a.status === "late").length;

  return (
    <>
      <PageHeader
        title={personName(student)}
        description={`${student.student_number} · ${
          college
            ? activeEnrollment?.programs
              ? `${activeEnrollment.programs.code} ${activeEnrollment.programs.name}`
              : "No active program"
            : currentPlacement?.sections
              ? `${currentPlacement.sections.grade_levels?.name ?? ""} ${currentPlacement.sections.name}`
              : "Not placed this year"
        }`}
        actions={
          registrar && !college && term ? (
            <a
              className={buttonVariants({ variant: "secondary" })}
              href={`/reports/report-card/${id}/${term.id}`}
            >
              Report card PDF
            </a>
          ) : registrar ? (
            <>
              <a
                className={buttonVariants({ variant: "secondary" })}
                href={`/reports/transcript/${id}`}
              >
                Transcript PDF
              </a>
              {term ? (
                <a
                  className={buttonVariants({ variant: "secondary" })}
                  href={`/reports/grade-report/${id}/${term.id}`}
                >
                  Grade report PDF
                </a>
              ) : null}
            </>
          ) : null
        }
      />
      {admitted ? (
        <Alert tone="success" className="mb-6">
          Student admitted with number {student.student_number}.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-8">
        <Section title="Details" id="details">
          <div className="flex flex-wrap gap-2">
            <Badge variant={student.status === "active" ? "brand" : "neutral"}>
              {student.status}
            </Badge>
            {student.user_id ? <Badge variant="info">Portal sign-in active</Badge> : null}
          </div>
          {registrar ? (
            <ActionForm
              action={updateStudent}
              resetOnSuccess={false}
              aria-label="Student details"
              className="max-w-3xl"
            >
              <input type="hidden" name="id" value={student.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="first_name" label="First name" required>
                  <Input defaultValue={student.first_name} />
                </FormField>
                <FormField name="middle_name" label="Middle name">
                  <Input defaultValue={student.middle_name ?? ""} />
                </FormField>
                <FormField name="last_name" label="Last name" required>
                  <Input defaultValue={student.last_name} />
                </FormField>
                <FormField name="sex" label="Sex">
                  <Select defaultValue={student.sex ?? ""}>
                    <option value="">Not given</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </Select>
                </FormField>
                <FormField name="date_of_birth" label="Date of birth">
                  <Input type="date" defaultValue={student.date_of_birth ?? ""} />
                </FormField>
                <FormField name="status" label="Status" required>
                  <Select defaultValue={student.status}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="graduated">Graduated</option>
                  </Select>
                </FormField>
                <FormField name="phone" label="Phone">
                  <Input type="tel" defaultValue={student.phone ?? ""} />
                </FormField>
                <FormField name="email" label="Email">
                  <Input type="email" defaultValue={student.email ?? ""} />
                </FormField>
                <FormField name="address" label="Address" className="sm:col-span-2">
                  <Textarea rows={2} defaultValue={student.address ?? ""} />
                </FormField>
              </div>
              <div>
                <SubmitButton>Save details</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <dl className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["Date of birth", date(student.date_of_birth, settings.timezone)],
                ["Phone", student.phone ?? "-"],
                ["Email", student.email ?? "-"],
                ["Address", student.address ?? "-"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm font-semibold text-muted">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        <Section title="Guardians" id="guardians">
          {guardians.length === 0 ? (
            <p className="text-muted">No guardian recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {guardians.map((g) =>
                g.guardians ? (
                  <li
                    key={g.guardians.id}
                    className="rounded-lg border border-border bg-background px-4 py-3"
                  >
                    <span className="font-semibold">
                      {g.guardians.first_name} {g.guardians.last_name}
                    </span>
                    {g.guardians.relationship ? ` · ${g.guardians.relationship}` : ""}
                    {g.guardians.phone ? ` · ${g.guardians.phone}` : ""}
                    {g.is_primary ? (
                      <Badge variant="brand" className="ml-2">
                        Primary
                      </Badge>
                    ) : null}
                    {g.guardians.user_id ? (
                      <Badge variant="info" className="ml-2">
                        Parent sign-in active
                      </Badge>
                    ) : null}
                    {superAdmin && !college ? (
                      // Stays mounted after saving so the one-time password message remains visible.
                      <ActionForm
                        action={createParentLogin}
                        resetOnSuccess={false}
                        aria-label={`Parent sign-in for ${g.guardians.first_name}`}
                        className="mt-3 max-w-md"
                      >
                        {g.guardians.user_id ? null : (
                          <>
                            <input type="hidden" name="guardian_id" value={g.guardians.id} />
                            <FormField
                              name="email"
                              label="Parent email"
                              id={`parent-email-${g.guardians.id}`}
                              required
                            >
                              <Input type="email" defaultValue={g.guardians.email ?? ""} />
                            </FormField>
                            <div>
                              <SubmitButton variant="secondary" size="sm">
                                Create parent sign-in
                              </SubmitButton>
                            </div>
                          </>
                        )}
                      </ActionForm>
                    ) : null}
                  </li>
                ) : null,
              )}
            </ul>
          )}
          {registrar ? (
            <details className="max-w-3xl rounded-xl border border-border bg-background p-4">
              <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                Add a guardian
              </summary>
              <ActionForm action={addGuardian} aria-label="Add a guardian" className="mt-3">
                <input type="hidden" name="student_id" value={id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField name="first_name" label="First name" required>
                    <Input />
                  </FormField>
                  <FormField name="last_name" label="Last name" required>
                    <Input />
                  </FormField>
                  <FormField name="relationship" label="Relationship">
                    <Input />
                  </FormField>
                  <FormField name="phone" label="Phone">
                    <Input type="tel" />
                  </FormField>
                  <FormField name="email" label="Email">
                    <Input type="email" />
                  </FormField>
                </div>
                <div>
                  <SubmitButton>Add guardian</SubmitButton>
                </div>
              </ActionForm>
            </details>
          ) : null}
        </Section>

        {college ? (
          <Section title="Program" id="program">
            {enrollments.length === 0 ? (
              <p className="text-muted">Not enrolled in a program.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {enrollments.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-border bg-background px-4 py-3"
                  >
                    <span className="font-semibold">
                      {e.programs?.code} {e.programs?.name}
                    </span>{" "}
                    from {e.terms ? termLabel(e.terms) : "-"}{" "}
                    <Badge variant={e.status === "active" ? "brand" : "neutral"}>{e.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {registrar ? (
              <details className="max-w-3xl rounded-xl border border-border bg-background p-4">
                <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                  {activeEnrollment ? "Change program" : "Enroll in a program"}
                </summary>
                <ActionForm
                  action={enrollInProgram}
                  aria-label="Program enrollment"
                  className="mt-3"
                >
                  <input type="hidden" name="student_id" value={id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField name="program_id" label="Program" required>
                      <Select defaultValue="">
                        <option value="">Choose a program</option>
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} {p.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField name="start_term_id" label="Start term" required>
                      <Select defaultValue={term?.id ?? ""}>
                        <option value="">Choose a term</option>
                        {terms.map((t) => (
                          <option key={t.id} value={t.id}>
                            {termLabel(t)}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>
                  <div>
                    <SubmitButton>Save enrollment</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            ) : null}
          </Section>
        ) : (
          <Section title="Class" id="class">
            {placements.length === 0 ? (
              <p className="text-muted">Not placed in a class.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {placements.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-border bg-background px-4 py-3"
                  >
                    <span className="font-semibold">
                      {p.sections?.grade_levels?.name} {p.sections?.name}
                    </span>{" "}
                    in {p.academic_years?.name}
                  </li>
                ))}
              </ul>
            )}
            {registrar && sections.length > 0 ? (
              <ActionForm
                action={placeStudent}
                resetOnSuccess={false}
                aria-label="Class placement"
                className="max-w-md"
              >
                <input type="hidden" name="student_id" value={id} />
                <FormField
                  name="section_id"
                  label={
                    currentPlacement
                      ? "Move to another class this year"
                      : "Place in a class this year"
                  }
                  required
                >
                  <Select defaultValue={currentPlacement?.sections?.id ?? ""}>
                    <option value="">Choose a class</option>
                    {sections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.grade_levels?.name} {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div>
                  <SubmitButton variant="secondary">Save class</SubmitButton>
                </div>
              </ActionForm>
            ) : null}
          </Section>
        )}

        {registrar && college ? (
          <Section title="Courses" id="courses">
            {sortedRegs.length === 0 ? (
              <p className="text-muted">No course registrations.</p>
            ) : (
              <TableScroll label="Course registrations">
                <Table>
                  <thead>
                    <tr>
                      <Th>Term</Th>
                      <Th>Course</Th>
                      <Th>Credits</Th>
                      <Th>Status</Th>
                      <Th>
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRegs.map((r) => {
                      const o = r.course_offerings;
                      return (
                        <tr key={r.id}>
                          <Td>{o?.terms ? termLabel(o.terms) : "-"}</Td>
                          <Td>
                            <span className="font-semibold">{o?.courses?.code}</span>{" "}
                            {o?.courses?.title} ({o?.section})
                            {r.decision_note ? (
                              <p className="text-sm text-muted">{r.decision_note}</p>
                            ) : null}
                          </Td>
                          <Td>{o?.courses?.credits}</Td>
                          <Td>
                            <Badge
                              variant={
                                r.status === "approved"
                                  ? "brand"
                                  : r.status === "rejected" || r.status === "dropped"
                                    ? "neutral"
                                    : "info"
                              }
                            >
                              {r.status}
                            </Badge>
                          </Td>
                          <Td className="text-right">
                            {["planned", "submitted", "approved"].includes(r.status) ? (
                              <ConfirmAction
                                action={registrarDrop}
                                fields={{ registration_id: r.id }}
                                triggerLabel="Drop"
                                title={`Drop ${o?.courses?.code ?? "this course"}?`}
                                description="The registration stays on record as dropped. The reason is kept in the audit log."
                                confirmLabel="Drop course"
                                reasonLabel="Reason"
                              />
                            ) : null}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableScroll>
            )}
            {term && offerings.length > 0 ? (
              <details className="max-w-3xl rounded-xl border border-border bg-background p-4">
                <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                  Add a course for {termLabel(term)}
                </summary>
                <ActionForm action={registrarRegister} aria-label="Add a course" className="mt-3">
                  <input type="hidden" name="student_id" value={id} />
                  <FormField name="offering_id" label="Course" required>
                    <Select defaultValue="">
                      <option value="">Choose a course</option>
                      {offerings.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.courses?.code} {o.courses?.title} (section {o.section})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField name="reason" label="Reason" hint="Kept in the audit log." required>
                    <Textarea rows={2} />
                  </FormField>
                  <div>
                    <SubmitButton>Add course</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            ) : null}
          </Section>
        ) : null}

        {record ? (
          <Section title="Results" id="results">
            <p>
              Cumulative GPA <strong>{formatGpa(record.cgpa)}</strong> · {record.creditsEarned}{" "}
              credits earned · Attendance {percent(attended, attendance.length)}
            </p>
            {record.terms.length === 0 ? (
              <p className="text-muted">No published grades yet.</p>
            ) : (
              record.terms.map((t) => (
                <p key={t.termId}>
                  {t.termName}: GPA {formatGpa(t.gpa)}, {t.creditsEarned} credits
                </p>
              ))
            )}
          </Section>
        ) : null}

        {termReports.length > 0 ? (
          <Section title="Results" id="results" description="Published scores for this year.">
            {termReports.map((r) =>
              r ? (
                <p key={r.term.id}>
                  {r.term.label}: overall average <strong>{formatScore(r.overall)}</strong>{" "}
                  <a
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                    href={`/reports/report-card/${id}/${r.term.id}`}
                  >
                    Report card<span className="sr-only"> for {r.term.label}</span>
                  </a>
                </p>
              ) : null,
            )}
          </Section>
        ) : null}

        {bursar ? (
          <Section title="Fees" id="fees">
            {balances.length === 0 ? (
              <p className="text-muted">Nothing due.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {balances.map((b) => (
                  <li key={b.currency}>
                    Balance due: <strong>{money(b.balance_minor ?? 0, b.currency ?? "USD")}</strong>
                  </li>
                ))}
              </ul>
            )}
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-primary underline"
              href={`/fees/invoices?student=${id}`}
            >
              See invoices and payments
            </Link>
          </Section>
        ) : null}

        {memberHas(member, ["super_admin"]) ? (
          <Section title="Portal sign-in" id="portal">
            <p className="text-ink-soft">
              The student can see their published grades, attendance, fees and announcements.
            </p>
            {/* Stays mounted after saving so the one-time password message remains visible. */}
            <ActionForm
              action={createStudentLogin}
              resetOnSuccess={false}
              aria-label="Create portal sign-in"
              className="max-w-md"
            >
              {student.user_id ? (
                <p className="font-medium">
                  Portal sign-in is active{student.email ? ` for ${student.email}` : ""}.
                </p>
              ) : (
                <>
                  <input type="hidden" name="student_id" value={id} />
                  <FormField name="email" label="Student email" required>
                    <Input type="email" defaultValue={student.email ?? ""} />
                  </FormField>
                  <div>
                    <SubmitButton>Create sign-in</SubmitButton>
                  </div>
                </>
              )}
            </ActionForm>
          </Section>
        ) : null}
      </div>
    </>
  );
}
