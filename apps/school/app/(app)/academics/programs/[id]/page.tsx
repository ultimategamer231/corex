import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { isUuid } from "@/lib/ids";
import { addRequirement, removeRequirement } from "../../actions";

export const metadata: Metadata = { title: "Program" };

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles(REGISTRAR);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: program, error } = await supabase
    .from("programs")
    .select("id, code, name, award, total_credits_required, duration_terms")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!program) notFound();
  const [requirements, courses] = await Promise.all([
    supabase
      .from("program_requirements")
      .select("course_id, requirement_type, recommended_term, courses(code, title, credits)")
      .eq("program_id", id)
      .then(rows),
    supabase.from("courses").select("id, code, title").order("code").then(rows),
  ]);
  requirements.sort(
    (a, b) =>
      (a.recommended_term ?? 99) - (b.recommended_term ?? 99) ||
      (a.courses?.code ?? "").localeCompare(b.courses?.code ?? ""),
  );
  const listed = new Set(requirements.map((r) => r.course_id));
  const credits = requirements.reduce((sum, r) => sum + (r.courses?.credits ?? 0), 0);
  return (
    <>
      <PageHeader
        title={`${program.code} ${program.name}`}
        description={`${program.award} · ${program.total_credits_required} credits · ${program.duration_terms} terms · ${credits} credits listed below`}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="Program requirements" id="requirements">
          {requirements.length === 0 ? (
            <p className="text-muted">
              No courses listed yet. Students see these in course planning.
            </p>
          ) : (
            <TableScroll label="Program requirements">
              <Table>
                <thead>
                  <tr>
                    <Th>Term</Th>
                    <Th>Course</Th>
                    <Th>Credits</Th>
                    <Th>Type</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r) => (
                    <tr key={r.course_id}>
                      <Td>{r.recommended_term ?? "-"}</Td>
                      <Td>
                        <span className="font-semibold">{r.courses?.code}</span> {r.courses?.title}
                      </Td>
                      <Td>{r.courses?.credits}</Td>
                      <Td>
                        <Badge variant={r.requirement_type === "core" ? "brand" : "neutral"}>
                          {r.requirement_type}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <ConfirmAction
                          action={removeRequirement}
                          fields={{ program_id: id, course_id: r.course_id }}
                          triggerLabel="Remove"
                          title={`Remove ${r.courses?.code ?? "this course"} from the program?`}
                          description="Students already registered keep their registrations."
                          confirmLabel="Remove"
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Add a course" id="add">
          <ActionForm
            action={addRequirement}
            aria-label="Add a required course"
            className="rounded-xl border border-border bg-background p-5"
          >
            <input type="hidden" name="program_id" value={id} />
            <FormField name="course_id" label="Course" required>
              <Select defaultValue="">
                <option value="">Choose a course</option>
                {courses
                  .filter((c) => !listed.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} {c.title}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField name="requirement_type" label="Type" required>
              <Select defaultValue="core">
                <option value="core">Core</option>
                <option value="elective">Elective</option>
              </Select>
            </FormField>
            <FormField
              name="recommended_term"
              label="Recommended term"
              hint="1 for the first term of the program."
            >
              <Input type="number" inputMode="numeric" min={1} />
            </FormField>
            <div>
              <SubmitButton>Add course</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
