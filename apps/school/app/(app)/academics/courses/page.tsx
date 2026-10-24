import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createCourse } from "../actions";

export const metadata: Metadata = { title: "Courses" };

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function CoursesPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(REGISTRAR);
  const params = await searchParams;
  const q = (params.q ?? "")
    .replace(/[,()*%\\]/g, " ")
    .trim()
    .slice(0, 60);
  const page = pageFrom(params.page);
  let query = supabase
    .from("courses")
    .select(
      "id, code, title, credits, departments(code), prerequisites:course_prerequisites!course_prerequisites_course_id_fkey(prerequisite_course_id)",
      {
        count: "exact",
      },
    )
    .order("code")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`code.ilike.*${q}*,title.ilike.*${q}*`);
  const [{ data: courses, count, error }, departments] = await Promise.all([
    query,
    supabase.from("departments").select("id, name").order("name").then(rows),
  ]);
  if (error) throw new Error(error.message);
  return (
    <>
      <PageHeader title="Courses" description={`${count ?? 0} courses`} />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="Course catalogue" id="list">
          <form className="flex flex-wrap items-end gap-3" role="search" aria-label="Find courses">
            <div className="flex min-w-52 flex-1 flex-col gap-1.5">
              <Label htmlFor="q">Code or title</Label>
              <Input id="q" name="q" type="search" defaultValue={q} />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          {courses.length === 0 ? (
            <p className="text-muted">{q ? "No courses match." : "No courses yet."}</p>
          ) : (
            <>
              <TableScroll label="Courses">
                <Table>
                  <thead>
                    <tr>
                      <Th>Code</Th>
                      <Th>Title</Th>
                      <Th>Credits</Th>
                      <Th>Prerequisites</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c) => (
                      <tr key={c.id}>
                        <Td className="font-mono text-sm whitespace-nowrap">{c.code}</Td>
                        <Td>
                          <Link
                            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                            href={`/academics/courses/${c.id}`}
                          >
                            {c.title}
                          </Link>
                          <p className="text-sm text-muted">{c.departments?.code}</p>
                        </Td>
                        <Td>{c.credits}</Td>
                        <Td>{c.prerequisites.length}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
              <Pagination
                page={page}
                total={count ?? 0}
                hrefFor={(p) =>
                  `/academics/courses?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`
                }
              />
            </>
          )}
        </Section>
        <Section title="Add a course" id="add">
          {departments.length === 0 ? (
            <p className="text-muted">Add a department first.</p>
          ) : (
            <ActionForm
              action={createCourse}
              aria-label="Add a course"
              className="rounded-xl border border-border bg-background p-5"
            >
              <FormField name="department_id" label="Department" required>
                <Select defaultValue="">
                  <option value="">Choose a department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField name="code" label="Code" hint="For example MATH 101." required>
                <Input />
              </FormField>
              <FormField name="title" label="Title" required>
                <Input />
              </FormField>
              <FormField name="credits" label="Credits" required>
                <Input type="number" inputMode="numeric" min={1} max={12} />
              </FormField>
              <FormField name="description" label="Description">
                <Textarea rows={3} />
              </FormField>
              <div>
                <SubmitButton>Add course</SubmitButton>
              </div>
            </ActionForm>
          )}
        </Section>
      </div>
    </>
  );
}
