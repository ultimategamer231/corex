import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { requireEdition } from "@/lib/edition";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { addSectionSubject, updateSection, updateSectionSubject } from "../../actions";

export const metadata: Metadata = { title: "Section" };

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("highschool");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const section = await supabase
    .from("sections")
    .select("id, name, homeroom_teacher_id, grade_levels(name), academic_years(name)")
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!section) notFound();
  const [subjects, allSubjects, teachers, students] = await Promise.all([
    supabase
      .from("section_subjects")
      .select("id, teacher_id, subjects(name, code)")
      .eq("section_id", id)
      .then(rows),
    supabase.from("subjects").select("id, name").order("name").then(rows),
    supabase.rpc("members_with_role", { p_role: "teacher" }).then(rows),
    supabase
      .from("student_placements")
      .select("students(id, student_number, first_name, middle_name, last_name)")
      .eq("section_id", id)
      .then(rows),
  ]);
  subjects.sort((a, b) => (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? ""));
  students.sort((a, b) => (a.students?.last_name ?? "").localeCompare(b.students?.last_name ?? ""));
  const teacherOptions = (
    <>
      <option value="">Not assigned</option>
      {teachers.map((t) => (
        <option key={t.user_id} value={t.user_id}>
          {t.display_name}
        </option>
      ))}
    </>
  );
  const title = `${section.grade_levels?.name ?? ""} ${section.name}`;
  return (
    <>
      <PageHeader
        title={title}
        description={`${section.academic_years?.name ?? ""} · ${students.length} students`}
      />
      <div className="flex flex-col gap-8">
        <Section title="Homeroom teacher" id="homeroom">
          <ActionForm
            action={updateSection}
            resetOnSuccess={false}
            aria-label="Homeroom teacher"
            className="max-w-md"
          >
            <input type="hidden" name="id" value={id} />
            <FormField name="homeroom_teacher_id" label="Homeroom teacher">
              <Select defaultValue={section.homeroom_teacher_id ?? ""}>{teacherOptions}</Select>
            </FormField>
            <div>
              <SubmitButton variant="secondary">Save</SubmitButton>
            </div>
          </ActionForm>
        </Section>
        <Section title="Subjects and teachers" id="subjects">
          {subjects.length === 0 ? (
            <p className="text-muted">
              No subjects yet. Students in this section take every subject listed here.
            </p>
          ) : (
            <TableScroll label="Subjects and teachers">
              <Table>
                <thead>
                  <tr>
                    <Th>Subject</Th>
                    <Th>Teacher</Th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <Td className="font-semibold">{s.subjects?.name}</Td>
                      <Td>
                        <ActionForm
                          action={updateSectionSubject}
                          resetOnSuccess={false}
                          aria-label={`Teacher for ${s.subjects?.name ?? ""}`}
                          className="flex-row flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <FormField name="teacher_id" label="Teacher" id={`teacher-${s.id}`}>
                            <Select defaultValue={s.teacher_id ?? ""} className="w-56">
                              {teacherOptions}
                            </Select>
                          </FormField>
                          <SubmitButton variant="secondary" size="sm">
                            Save<span className="sr-only"> teacher for {s.subjects?.name}</span>
                          </SubmitButton>
                        </ActionForm>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
          <ActionForm
            action={addSectionSubject}
            aria-label="Add a subject"
            className="max-w-2xl rounded-xl border border-border bg-background p-5"
          >
            <input type="hidden" name="section_id" value={id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="subject_id" label="Subject" required>
                <Select defaultValue="">
                  <option value="">Choose a subject</option>
                  {allSubjects
                    .filter((s) => !subjects.some((x) => x.subjects?.name === s.name))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              </FormField>
              <FormField name="teacher_id" label="Teacher">
                <Select defaultValue="">{teacherOptions}</Select>
              </FormField>
            </div>
            <div>
              <SubmitButton>Add subject</SubmitButton>
            </div>
          </ActionForm>
        </Section>
        <Section title="Students" id="students">
          {students.length === 0 ? (
            <p className="text-muted">
              No students placed yet. Place students from their profile or at admission.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {students.map((p) =>
                p.students ? (
                  <li key={p.students.id}>
                    <Link
                      className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                      href={`/students/${p.students.id}`}
                    >
                      {personName(p.students)}
                    </Link>{" "}
                    <span className="text-sm text-muted">{p.students.student_number}</span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
