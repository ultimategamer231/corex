import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { requireEdition } from "@/lib/edition";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createSection } from "../actions";

export const metadata: Metadata = { title: "Sections" };

type Props = { searchParams: Promise<{ year?: string }> };

export default async function SectionsPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("highschool");
  const years = rows(
    await supabase
      .from("academic_years")
      .select("id, name, is_current")
      .order("starts_on", { ascending: false }),
  );
  const requested = (await searchParams).year;
  const year = years.find((y) => y.id === requested) ?? years.find((y) => y.is_current) ?? years[0];
  if (!year)
    return (
      <PageHeader
        title="Sections"
        description="Add an academic year under Years and terms first."
      />
    );
  const [sections, levels, teachers] = await Promise.all([
    supabase
      .from("sections")
      .select(
        "id, name, homeroom_teacher_id, grade_levels(name, sort_order), section_subjects(id), student_placements(id)",
      )
      .eq("academic_year_id", year.id)
      .then(rows),
    supabase.from("grade_levels").select("id, name").order("sort_order").then(rows),
    supabase.rpc("members_with_role", { p_role: "teacher" }).then(rows),
  ]);
  sections.sort(
    (a, b) =>
      (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
      a.name.localeCompare(b.name),
  );
  const names = new Map(teachers.map((t) => [t.user_id, t.display_name]));
  return (
    <>
      <PageHeader title="Sections" description={`Classes in ${year.name}`} />
      <form className="mb-6 flex flex-wrap items-end gap-3" aria-label="Choose a year">
        <div className="flex w-60 flex-col gap-1.5">
          <Label htmlFor="year">Academic year</Label>
          <Select id="year" name="year" defaultValue={year.id}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="Sections" id="list">
          {sections.length === 0 ? (
            <p className="text-muted">No sections in this year yet.</p>
          ) : (
            <TableScroll label="Sections">
              <Table>
                <thead>
                  <tr>
                    <Th>Class</Th>
                    <Th>Homeroom teacher</Th>
                    <Th>Subjects</Th>
                    <Th>Students</Th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <Link
                          className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-primary hover:underline"
                          href={`/academics/sections/${s.id}`}
                        >
                          {s.grade_levels?.name} {s.name}
                        </Link>
                      </Td>
                      <Td>
                        {s.homeroom_teacher_id
                          ? (names.get(s.homeroom_teacher_id) ?? "Inactive member")
                          : "Not assigned"}
                      </Td>
                      <Td>{s.section_subjects.length}</Td>
                      <Td>{s.student_placements.length}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Add a section" id="add">
          <ActionForm
            action={createSection}
            aria-label="Add a section"
            className="rounded-xl border border-border bg-background p-5"
          >
            <input type="hidden" name="academic_year_id" value={year.id} />
            <FormField name="grade_level_id" label="Grade level" required>
              <Select defaultValue="">
                <option value="">Choose a grade level</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField name="name" label="Section" hint="For example A." required>
              <Input defaultValue="A" />
            </FormField>
            <FormField
              name="homeroom_teacher_id"
              label="Homeroom teacher"
              hint="Records the section's daily attendance."
            >
              <Select defaultValue="">
                <option value="">Not assigned</option>
                {teachers.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.display_name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div>
              <SubmitButton>Add section</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
