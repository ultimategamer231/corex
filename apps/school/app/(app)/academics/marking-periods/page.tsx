import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { requireEdition } from "@/lib/edition";
import { listTerms, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { addDefaultPeriods, createMarkingPeriod, removeMarkingPeriod } from "../actions";

export const metadata: Metadata = { title: "Marking periods" };

type Props = { searchParams: Promise<{ term?: string }> };

export default async function MarkingPeriodsPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("highschool");
  const terms = await listTerms(supabase);
  const requested = (await searchParams).term;
  const term = terms.find((t) => t.id === requested) ?? terms.find((t) => t.is_current) ?? terms[0];
  if (!term)
    return (
      <PageHeader title="Marking periods" description="Add a term under Years and terms first." />
    );
  const periods = rows(
    await supabase
      .from("marking_periods")
      .select("id, number, name, is_exam, weight")
      .eq("term_id", term.id)
      .order("number"),
  );
  const totalWeight = periods.reduce((sum, p) => sum + Number(p.weight), 0);
  return (
    <>
      <PageHeader
        title="Marking periods"
        description={`${termLabel(term)}. The semester average is the weighted average of these periods.`}
      />
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
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Section title="Periods" id="list">
          {periods.length === 0 ? (
            <ActionForm
              action={addDefaultPeriods}
              aria-label="Add the default periods"
              className="max-w-md"
            >
              <p className="text-muted">
                No marking periods yet. The usual setup is three periods and a semester exam,
                weighted equally.
              </p>
              <input type="hidden" name="term_id" value={term.id} />
              <div>
                <SubmitButton>Add the default periods</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <TableScroll label="Marking periods">
              <Table>
                <thead>
                  <tr>
                    <Th>Number</Th>
                    <Th>Name</Th>
                    <Th>Weight</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <Td>{p.number}</Td>
                      <Td className="font-semibold">
                        {p.name} {p.is_exam ? <Badge variant="info">Exam</Badge> : null}
                      </Td>
                      <Td>
                        {Number(p.weight)} of {totalWeight}
                      </Td>
                      <Td className="text-right">
                        <ConfirmAction
                          action={removeMarkingPeriod}
                          fields={{ id: p.id }}
                          triggerLabel={`Remove ${p.name}`}
                          title={`Remove ${p.name}?`}
                          description="Only marking periods without scores can be removed."
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
        <Section title="Add a period" id="add">
          <ActionForm
            action={createMarkingPeriod}
            aria-label="Add a marking period"
            className="rounded-xl border border-border bg-background p-5"
          >
            <input type="hidden" name="term_id" value={term.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="number" label="Number" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  defaultValue={periods.length + 1}
                />
              </FormField>
              <FormField name="weight" label="Weight" required>
                <Input type="number" inputMode="decimal" min={0.01} step="0.01" defaultValue={1} />
              </FormField>
            </div>
            <FormField name="name" label="Name" required>
              <Input />
            </FormField>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="is_exam" className="size-5" />
              This is an exam
            </label>
            <div>
              <SubmitButton>Add period</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
