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
import { createGradeLevel } from "../actions";

export const metadata: Metadata = { title: "Grade levels" };

export default async function GradeLevelsPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("highschool");
  const levels = rows(
    await supabase.from("grade_levels").select("id, name, sort_order").order("sort_order"),
  );
  return (
    <>
      <PageHeader
        title="Grade levels"
        description="Promotion moves students to the next level in this order."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="Levels" id="list">
          {levels.length === 0 ? (
            <p className="text-muted">No grade levels yet.</p>
          ) : (
            <TableScroll label="Grade levels">
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Name</Th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((l) => (
                    <tr key={l.id}>
                      <Td>{l.sort_order}</Td>
                      <Td className="font-semibold">{l.name}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Add a grade level" id="add">
          <ActionForm
            action={createGradeLevel}
            aria-label="Add a grade level"
            className="rounded-xl border border-border bg-background p-5"
          >
            <FormField name="name" label="Name" hint="For example Grade 10." required>
              <Input />
            </FormField>
            <FormField
              name="sort_order"
              label="Order"
              hint="Grade 10 is 10, Grade 11 is 11, and so on."
              required
            >
              <Input type="number" inputMode="numeric" min={0} />
            </FormField>
            <div>
              <SubmitButton>Add grade level</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
