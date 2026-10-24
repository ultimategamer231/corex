import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { listTerms, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { requireEdition } from "@/lib/edition";
import { createOffering, updateOffering } from "../actions";

export const metadata: Metadata = { title: "Course offerings" };

type Props = { searchParams: Promise<{ term?: string }> };

export default async function OfferingsPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("college");
  const terms = await listTerms(supabase);
  const requested = (await searchParams).term;
  const term = terms.find((t) => t.id === requested) ?? terms.find((t) => t.is_current) ?? terms[0];
  if (!term) {
    return (
      <>
        <PageHeader title="Course offerings" />
        <p className="text-muted">Add a term under Years and terms first.</p>
      </>
    );
  }
  const [offerings, courses, instructors] = await Promise.all([
    supabase
      .from("course_offerings")
      .select(
        "id, section, capacity, status, schedule_text, instructor_id, courses(code, title, credits), course_registrations(status)",
      )
      .eq("term_id", term.id)
      .then(rows),
    supabase.from("courses").select("id, code, title").order("code").then(rows),
    supabase.rpc("members_with_role", { p_role: "instructor" }).then(rows),
  ]);
  offerings.sort(
    (a, b) =>
      (a.courses?.code ?? "").localeCompare(b.courses?.code ?? "") ||
      a.section.localeCompare(b.section),
  );
  const names = new Map(instructors.map((i) => [i.user_id, i.display_name]));
  const instructorOptions = (
    <>
      <option value="">Not assigned</option>
      {instructors.map((i) => (
        <option key={i.user_id} value={i.user_id}>
          {i.display_name}
        </option>
      ))}
    </>
  );
  return (
    <>
      <PageHeader title="Course offerings" description={termLabel(term)} />
      <form className="mb-6 flex flex-wrap items-end gap-3" aria-label="Choose a term">
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="term">Term</Label>
          <Select id="term" name="term" defaultValue={term.id}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {termLabel(t)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>
      <div className="flex flex-col gap-8">
        <Section title="Offerings" id="list">
          {offerings.length === 0 ? (
            <p className="text-muted">No courses offered in this term yet.</p>
          ) : (
            <TableScroll label="Course offerings">
              <Table>
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Section</Th>
                    <Th>Instructor</Th>
                    <Th>Seats</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Edit</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((o) => {
                    const taken = o.course_registrations.filter(
                      (r) => r.status === "approved",
                    ).length;
                    const waiting = o.course_registrations.filter(
                      (r) => r.status === "submitted",
                    ).length;
                    return (
                      <tr key={o.id}>
                        <Td>
                          <span className="font-semibold">{o.courses?.code}</span>{" "}
                          {o.courses?.title}
                          {o.schedule_text ? (
                            <p className="text-sm text-muted">{o.schedule_text}</p>
                          ) : null}
                        </Td>
                        <Td>{o.section}</Td>
                        <Td>
                          {o.instructor_id
                            ? (names.get(o.instructor_id) ?? "Inactive member")
                            : "Not assigned"}
                        </Td>
                        <Td className="whitespace-nowrap">
                          {taken} of {o.capacity}
                          {waiting ? <p className="text-sm text-muted">{waiting} waiting</p> : null}
                        </Td>
                        <Td>
                          <Badge variant={o.status === "open" ? "brand" : "neutral"}>
                            {o.status}
                          </Badge>
                        </Td>
                        <Td>
                          <details>
                            <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                              Edit
                              <span className="sr-only">
                                {" "}
                                {o.courses?.code} section {o.section}
                              </span>
                            </summary>
                            <ActionForm
                              action={updateOffering}
                              resetOnSuccess={false}
                              aria-label={`Edit ${o.courses?.code ?? ""} section ${o.section}`}
                              className="mt-2 w-64"
                            >
                              <input type="hidden" name="id" value={o.id} />
                              <FormField
                                name="instructor_id"
                                label="Instructor"
                                id={`instructor-${o.id}`}
                              >
                                <Select defaultValue={o.instructor_id ?? ""}>
                                  {instructorOptions}
                                </Select>
                              </FormField>
                              <FormField
                                name="capacity"
                                label="Capacity"
                                id={`capacity-${o.id}`}
                                required
                              >
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  defaultValue={o.capacity}
                                />
                              </FormField>
                              <FormField name="status" label="Status" id={`status-${o.id}`}>
                                <Select defaultValue={o.status}>
                                  <option value="open">Open</option>
                                  <option value="closed">Closed</option>
                                </Select>
                              </FormField>
                              <FormField
                                name="schedule_text"
                                label="Schedule"
                                id={`schedule-${o.id}`}
                              >
                                <Input defaultValue={o.schedule_text ?? ""} />
                              </FormField>
                              <SubmitButton size="sm">Save</SubmitButton>
                            </ActionForm>
                          </details>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Offer a course" id="add">
          <ActionForm
            action={createOffering}
            aria-label="Offer a course"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <input type="hidden" name="term_id" value={term.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="course_id" label="Course" required>
                <Select defaultValue="">
                  <option value="">Choose a course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} {c.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField name="instructor_id" label="Instructor">
                <Select defaultValue="">{instructorOptions}</Select>
              </FormField>
              <FormField name="section" label="Section" required>
                <Input defaultValue="A" />
              </FormField>
              <FormField name="capacity" label="Capacity" required>
                <Input type="number" inputMode="numeric" min={1} defaultValue={40} />
              </FormField>
              <FormField
                name="schedule_text"
                label="Schedule"
                hint="For example Mon and Wed, 9:00 to 10:30, Room 4."
                className="sm:col-span-2"
              >
                <Input />
              </FormField>
            </div>
            <div>
              <SubmitButton>Offer course</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
