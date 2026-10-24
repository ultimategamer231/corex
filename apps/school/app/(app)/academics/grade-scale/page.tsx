import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { addGrade, removeGrade } from "../actions";

export const metadata: Metadata = { title: "Grade scale" };

export default async function GradeScalePage() {
  const { supabase } = await requireRoles(REGISTRAR);
  const grades = rows(
    await supabase
      .from("grade_scale")
      .select("id, letter, min_score, max_score, grade_points, is_passing")
      .order("min_score", { ascending: false }),
  );
  return (
    <>
      <PageHeader
        title="Grade scale"
        description="Maps a course score (0 to 100) to a letter and grade points."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="Scale" id="list">
          {grades.length === 0 ? (
            <p className="text-muted">
              No grades yet. Grades cannot be submitted until the scale is set.
            </p>
          ) : (
            <TableScroll label="Grade scale">
              <Table>
                <thead>
                  <tr>
                    <Th>Letter</Th>
                    <Th>Score range</Th>
                    <Th>Grade points</Th>
                    <Th>Pass</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id}>
                      <Td className="font-bold">{g.letter}</Td>
                      <Td>
                        {Number(g.min_score)} to {Number(g.max_score)}
                      </Td>
                      <Td>
                        {g.grade_points === null
                          ? "Not counted"
                          : Number(g.grade_points).toFixed(2)}
                      </Td>
                      <Td>
                        {g.is_passing ? <Badge variant="brand">Pass</Badge> : <Badge>Fail</Badge>}
                      </Td>
                      <Td className="text-right">
                        <ConfirmAction
                          action={removeGrade}
                          fields={{ id: g.id }}
                          triggerLabel="Remove"
                          title={`Remove grade ${g.letter}?`}
                          description="Existing final grades keep their letter. New grades will use the remaining scale."
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
        <Section title="Add a grade" id="add">
          <ActionForm
            action={addGrade}
            aria-label="Add a grade"
            className="rounded-xl border border-border bg-background p-5"
          >
            <FormField name="letter" label="Letter" required>
              <Input />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="min_score" label="Lowest score" required>
                <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" />
              </FormField>
              <FormField name="max_score" label="Highest score" required>
                <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" />
              </FormField>
            </div>
            <FormField
              name="grade_points"
              label="Grade points"
              hint="0 to 5. Leave empty for marks that do not count, such as W."
            >
              <Input type="number" inputMode="decimal" min={0} max={5} step="0.01" />
            </FormField>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="is_passing" className="size-5" defaultChecked />
              Passing grade
            </label>
            <div>
              <SubmitButton>Add grade</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
