import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { isUuid } from "@/lib/ids";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { requireEdition } from "@/lib/edition";
import { addPrerequisite, removePrerequisite } from "../../actions";

export const metadata: Metadata = { title: "Course" };

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("college");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, code, title, credits, description, departments(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!course) notFound();
  const [prerequisites, courses] = await Promise.all([
    supabase
      .from("course_prerequisites")
      .select(
        "prerequisite_course_id, prerequisite:courses!course_prerequisites_prerequisite_course_id_fkey(code, title)",
      )
      .eq("course_id", id)
      .then(rows),
    supabase.from("courses").select("id, code, title").neq("id", id).order("code").then(rows),
  ]);
  const taken = new Set(prerequisites.map((p) => p.prerequisite_course_id));
  return (
    <>
      <PageHeader
        title={`${course.code} ${course.title}`}
        description={`${course.credits} credits · ${course.departments?.name ?? ""}`}
      />
      {course.description ? (
        <p className="mb-6 max-w-prose text-ink-soft">{course.description}</p>
      ) : null}
      <Section
        title="Prerequisites"
        id="prerequisites"
        description="Students must pass these before planning this course."
      >
        {prerequisites.length === 0 ? (
          <p className="text-muted">None.</p>
        ) : (
          <ul className="flex max-w-2xl flex-col gap-2">
            {prerequisites.map((p) => (
              <li
                key={p.prerequisite_course_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-2"
              >
                <span>
                  <span className="font-semibold">{p.prerequisite?.code}</span>{" "}
                  {p.prerequisite?.title}
                </span>
                <ConfirmAction
                  action={removePrerequisite}
                  fields={{ course_id: id, prerequisite_course_id: p.prerequisite_course_id }}
                  triggerLabel="Remove"
                  title={`Remove ${p.prerequisite?.code ?? "this"} as a prerequisite?`}
                  description="Students will be able to plan this course without it."
                  confirmLabel="Remove"
                />
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addPrerequisite} aria-label="Add a prerequisite" className="max-w-md">
          <input type="hidden" name="course_id" value={id} />
          <FormField name="prerequisite_course_id" label="Add a prerequisite" required>
            <Select defaultValue="">
              <option value="">Choose a course</option>
              {courses
                .filter((c) => !taken.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.title}
                  </option>
                ))}
            </Select>
          </FormField>
          <div>
            <SubmitButton>Add prerequisite</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
