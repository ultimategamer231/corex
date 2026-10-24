import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { requireEdition } from "@/lib/edition";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createSubject } from "../actions";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("highschool");
  const subjects = rows(await supabase.from("subjects").select("id, name, code").order("name"));
  return (
    <>
      <PageHeader
        title="Subjects"
        description="Add subjects to each section under Sections, with their teacher."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="All subjects" id="list">
          {subjects.length === 0 ? (
            <p className="text-muted">No subjects yet.</p>
          ) : (
            <TableScroll label="Subjects">
              <Table>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <Td className="font-mono text-sm">{s.code}</Td>
                      <Td>{s.name}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Add a subject" id="add">
          <ActionForm
            action={createSubject}
            aria-label="Add a subject"
            className="rounded-xl border border-border bg-background p-5"
          >
            <FormField name="name" label="Name" required>
              <Input />
            </FormField>
            <FormField
              name="code"
              label="Code"
              hint="2 to 8 capital letters or digits, for example MATH."
              required
            >
              <Input />
            </FormField>
            <div>
              <SubmitButton>Add subject</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
