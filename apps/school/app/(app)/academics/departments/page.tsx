import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { requireEdition } from "@/lib/edition";
import { createDepartment } from "../actions";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("college");
  const departments = rows(
    await supabase
      .from("departments")
      .select("id, name, code, programs(id), courses(id)")
      .order("name"),
  );
  return (
    <>
      <PageHeader title="Departments" />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="All departments" id="list">
          {departments.length === 0 ? (
            <p className="text-muted">No departments yet.</p>
          ) : (
            <TableScroll label="Departments">
              <Table>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Programs</Th>
                    <Th>Courses</Th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <Td className="font-mono text-sm">{d.code}</Td>
                      <Td>{d.name}</Td>
                      <Td>{d.programs.length}</Td>
                      <Td>{d.courses.length}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Add a department" id="add">
          <ActionForm
            action={createDepartment}
            aria-label="Add a department"
            className="rounded-xl border border-border bg-background p-5"
          >
            <FormField name="name" label="Name" required>
              <Input />
            </FormField>
            <FormField
              name="code"
              label="Code"
              hint="2 to 10 capital letters or digits, for example SCI."
              required
            >
              <Input />
            </FormField>
            <div>
              <SubmitButton>Add department</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
