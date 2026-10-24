import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createProgram } from "../actions";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  const [programs, departments] = await Promise.all([
    supabase
      .from("programs")
      .select(
        "id, code, name, award, total_credits_required, duration_terms, departments(code), program_requirements(course_id)",
      )
      .order("code")
      .then(rows),
    supabase.from("departments").select("id, name, code").order("name").then(rows),
  ]);
  return (
    <>
      <PageHeader title="Programs" />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="All programs" id="list">
          {programs.length === 0 ? (
            <p className="text-muted">No programs yet.</p>
          ) : (
            <TableScroll label="Programs">
              <Table>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Award</Th>
                    <Th>Credits</Th>
                    <Th>Terms</Th>
                    <Th>Required courses</Th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p.id}>
                      <Td className="font-mono text-sm">{p.code}</Td>
                      <Td>
                        <Link
                          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                          href={`/academics/programs/${p.id}`}
                        >
                          {p.name}
                        </Link>
                        <p className="text-sm text-muted">{p.departments?.code}</p>
                      </Td>
                      <Td>{p.award}</Td>
                      <Td>{p.total_credits_required}</Td>
                      <Td>{p.duration_terms}</Td>
                      <Td>{p.program_requirements.length}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Add a program" id="add">
          {departments.length === 0 ? (
            <p className="text-muted">Add a department first.</p>
          ) : (
            <ActionForm
              action={createProgram}
              aria-label="Add a program"
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
              <FormField name="name" label="Name" required>
                <Input />
              </FormField>
              <FormField name="code" label="Code" hint="For example BSC-CS." required>
                <Input />
              </FormField>
              <FormField name="award" label="Award" required>
                <Select defaultValue="Bachelor">
                  {["Certificate", "Diploma", "Associate", "Bachelor"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </Select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="total_credits_required" label="Credits required" required>
                  <Input type="number" inputMode="numeric" min={1} />
                </FormField>
                <FormField name="duration_terms" label="Length in terms" required>
                  <Input type="number" inputMode="numeric" min={1} />
                </FormField>
              </div>
              <div>
                <SubmitButton>Add program</SubmitButton>
              </div>
            </ActionForm>
          )}
        </Section>
      </div>
    </>
  );
}
