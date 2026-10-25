import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { PendingSheets } from "@/components/pending";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { personName, todayIso } from "@/lib/format";
import { edition } from "@/lib/edition";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { currentTerm, rows, termLabel } from "@/lib/queries";
import { REGISTRAR, TEACHING } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { correctAttendance, recordAttendance } from "./actions";

export const metadata: Metadata = { title: "Attendance" };

const STATUSES = ["present", "absent", "late", "excused"] as const;

type Props = { searchParams: Promise<{ class?: string; offering?: string; date?: string }> };

export default async function AttendancePage({ searchParams }: Props) {
  const { supabase, member } = await requireRoles([...TEACHING, ...REGISTRAR]);
  const registrar = memberHas(member, REGISTRAR);
  const settings = await getSettings();
  const params = await searchParams;
  const today = todayIso(settings.timezone);
  const day =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today
      ? params.date
      : today;
  const term = await currentTerm(supabase);
  if (!term) return <PageHeader title="Attendance" description="Set a current term first." />;

  // College: course offerings by their instructor. High School: sections by their
  // homeroom teacher (SPEC.md 7.5). The Registrar sees every class of the term.
  const college = edition() === "college";
  const refType = college ? "offering" : "section";
  let classes: { id: string; label: string }[];
  if (college) {
    let q = supabase
      .from("course_offerings")
      .select("id, section, instructor_id, courses(code, title)")
      .eq("term_id", term.id);
    if (!registrar) q = q.eq("instructor_id", member.userId);
    classes = rows(await q)
      .map((o) => ({
        id: o.id,
        label: `${o.courses?.code ?? ""} ${o.courses?.title ?? ""} (${o.section})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } else {
    let q = supabase
      .from("sections")
      .select("id, name, homeroom_teacher_id, grade_levels(name, sort_order)")
      .eq("academic_year_id", term.academic_year_id);
    if (!registrar) q = q.eq("homeroom_teacher_id", member.userId);
    classes = rows(await q)
      .sort(
        (a, b) =>
          (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
          a.name.localeCompare(b.name),
      )
      .map((c) => ({ id: c.id, label: `${c.grade_levels?.name ?? ""} ${c.name}` }));
  }
  const wanted = params.class ?? params.offering;
  const selected =
    classes.find((c) => c.id === wanted) ?? (classes.length === 1 ? classes[0] : undefined);
  const offering = selected;

  const studentColumns =
    "student_id, students(id, student_number, first_name, middle_name, last_name)";
  const [classList, recorded] =
    selected && isUuid(selected.id)
      ? await Promise.all([
          college
            ? supabase
                .from("course_registrations")
                .select(studentColumns)
                .eq("offering_id", selected.id)
                .eq("status", "approved")
                .then(rows)
            : supabase
                .from("student_placements")
                .select(studentColumns)
                .eq("section_id", selected.id)
                .then(rows),
          supabase
            .from("attendance")
            .select("id, student_id, status, note")
            .eq("class_ref_type", refType)
            .eq("class_ref_id", selected.id)
            .eq("date", day)
            .then(rows),
        ])
      : [[], []];
  classList.sort((a, b) =>
    (a.students?.last_name ?? "").localeCompare(b.students?.last_name ?? ""),
  );
  const byStudent = new Map(recorded.map((r) => [r.student_id, r]));
  const unrecorded = classList.filter((c) => !byStudent.has(c.student_id));

  return (
    <>
      <PageHeader title="Attendance" description={termLabel(term)} />
      <form className="mb-6 flex flex-wrap items-end gap-3" aria-label="Choose a class and date">
        <div className="flex w-80 max-w-full flex-col gap-1.5">
          <Label htmlFor="class">Class</Label>
          <Select id="class" name="class" defaultValue={offering?.id ?? ""}>
            <option value="">Choose a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" max={today} defaultValue={day} />
        </div>
        <Button type="submit" variant="secondary">
          Open register
        </Button>
      </form>

      {classes.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck />}
          title="No classes"
          description="You have no classes assigned this term."
        />
      ) : !offering ? (
        <p className="text-muted">Choose a class to see its register.</p>
      ) : classList.length === 0 ? (
        <p className="text-muted">No students are registered in this class yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Stays mounted after saving so the confirmation remains visible. */}
          <PendingSheets table="attendance" label="Registers waiting to sync" />
          <ActionForm
            action={recordAttendance}
            aria-label="Class register"
            resetOnSuccess={false}
            offline="attendance"
          >
            {unrecorded.length > 0 ? (
              <>
                <input type="hidden" name="class_id" value={offering.id} />
                <input type="hidden" name="class_ref_type" value={refType} />
                <input type="hidden" name="date" value={day} />
                <TableScroll label="Class register">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Student</Th>
                        {STATUSES.map((s) => (
                          <Th key={s} className="text-center capitalize">
                            {s}
                          </Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unrecorded.map((c) => (
                        <tr key={c.student_id}>
                          <Td>
                            <input
                              type="hidden"
                              name={`id_${c.student_id}`}
                              value={crypto.randomUUID()}
                            />
                            <span className="font-semibold">
                              {c.students ? personName(c.students) : ""}
                            </span>
                            <p className="text-sm text-muted">{c.students?.student_number}</p>
                          </Td>
                          {STATUSES.map((s) => (
                            <Td key={s} className="text-center">
                              <input
                                type="radio"
                                name={`status_${c.student_id}`}
                                value={s}
                                defaultChecked={s === "present"}
                                aria-label={`${s} - ${c.students ? personName(c.students) : ""}`}
                                className="size-6"
                              />
                            </Td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableScroll>
                <div>
                  <SubmitButton variant="accent" pendingLabel="Saving register...">
                    Save register
                  </SubmitButton>
                </div>
              </>
            ) : null}
          </ActionForm>

          {recorded.length > 0 ? (
            <section aria-labelledby="recorded-title" className="flex flex-col gap-3">
              <h2 id="recorded-title" className="text-xl font-bold">
                Recorded
              </h2>
              {!registrar ? (
                <Alert tone="info">Recorded attendance can be corrected by the Registrar.</Alert>
              ) : null}
              <TableScroll label="Recorded attendance">
                <Table>
                  <thead>
                    <tr>
                      <Th>Student</Th>
                      <Th>Status</Th>
                      {registrar ? <Th>Correct</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {classList
                      .filter((c) => byStudent.has(c.student_id))
                      .map((c) => {
                        const r = byStudent.get(c.student_id);
                        if (!r) return null;
                        const name = c.students ? personName(c.students) : "";
                        return (
                          <tr key={c.student_id}>
                            <Td className="font-semibold">{name}</Td>
                            <Td>
                              <Badge
                                variant={
                                  r.status === "present"
                                    ? "brand"
                                    : r.status === "absent"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                {r.status}
                              </Badge>
                            </Td>
                            {registrar ? (
                              <Td>
                                <details>
                                  <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                                    Correct<span className="sr-only"> {name}</span>
                                  </summary>
                                  <ActionForm
                                    action={correctAttendance}
                                    aria-label={`Correct attendance for ${name}`}
                                    className="mt-2 w-72"
                                  >
                                    <input type="hidden" name="id" value={r.id} />
                                    <FormField
                                      name="status"
                                      label="New status"
                                      id={`status-${r.id}`}
                                      required
                                    >
                                      <Select defaultValue={r.status}>
                                        {STATUSES.map((s) => (
                                          <option key={s} value={s}>
                                            {s[0]?.toUpperCase() + s.slice(1)}
                                          </option>
                                        ))}
                                      </Select>
                                    </FormField>
                                    <FormField
                                      name="reason"
                                      label="Reason"
                                      id={`reason-${r.id}`}
                                      required
                                    >
                                      <Textarea rows={2} />
                                    </FormField>
                                    <SubmitButton size="sm">Save correction</SubmitButton>
                                  </ActionForm>
                                </details>
                              </Td>
                            ) : null}
                          </tr>
                        );
                      })}
                  </tbody>
                </Table>
              </TableScroll>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
