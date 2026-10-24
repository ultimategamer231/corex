import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { date } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { listTerms, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createTerm, createYear, makeTermCurrent, updateRegistrationWindow } from "../actions";

export const metadata: Metadata = { title: "Years and terms" };

export default async function CalendarPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  const settings = await getSettings();
  const [years, terms] = await Promise.all([
    supabase
      .from("academic_years")
      .select("id, name, starts_on, ends_on, is_current")
      .order("starts_on", { ascending: false })
      .then(rows),
    listTerms(supabase),
  ]);
  const tz = settings.timezone;
  return (
    <>
      <PageHeader
        title="Years and terms"
        description="The current term drives course planning, attendance and fees."
      />
      <div className="flex flex-col gap-8">
        <Section title="Terms" id="terms">
          {terms.length === 0 ? (
            <p className="text-muted">No terms yet. Add an academic year, then its terms.</p>
          ) : (
            <TableScroll label="Terms">
              <Table>
                <thead>
                  <tr>
                    <Th>Term</Th>
                    <Th>Dates</Th>
                    <Th>Course registration</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t) => (
                    <tr key={t.id}>
                      <Td>
                        <span className="font-semibold">{termLabel(t)}</span>{" "}
                        {t.is_current ? <Badge variant="brand">Current</Badge> : null}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {date(t.starts_on, tz)} to {date(t.ends_on, tz)}
                      </Td>
                      <Td>
                        <ActionForm
                          action={updateRegistrationWindow}
                          resetOnSuccess={false}
                          aria-label={`Registration dates for ${termLabel(t)}`}
                          className="gap-2"
                        >
                          <input type="hidden" name="id" value={t.id} />
                          <div className="flex flex-wrap items-end gap-2">
                            <FormField
                              name="registration_opens_on"
                              label="Opens"
                              id={`opens-${t.id}`}
                            >
                              <Input
                                type="date"
                                defaultValue={t.registration_opens_on ?? ""}
                                className="w-40"
                              />
                            </FormField>
                            <FormField
                              name="registration_closes_on"
                              label="Closes"
                              id={`closes-${t.id}`}
                            >
                              <Input
                                type="date"
                                defaultValue={t.registration_closes_on ?? ""}
                                className="w-40"
                              />
                            </FormField>
                            <SubmitButton variant="secondary" size="sm">
                              Save
                            </SubmitButton>
                          </div>
                        </ActionForm>
                      </Td>
                      <Td className="text-right">
                        {t.is_current ? null : (
                          <ConfirmAction
                            action={makeTermCurrent}
                            fields={{ id: t.id }}
                            triggerLabel="Make current"
                            title={`Make ${termLabel(t)} the current term?`}
                            description="Dashboards, attendance and course planning will use this term."
                            confirmLabel="Make current"
                            variant="primary"
                          />
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Add a term" id="add-term">
            {years.length === 0 ? (
              <p className="text-muted">Add an academic year first.</p>
            ) : (
              <ActionForm
                action={createTerm}
                aria-label="Add a term"
                className="rounded-xl border border-border bg-background p-5"
              >
                <FormField name="academic_year_id" label="Academic year" required>
                  <Select defaultValue={years.find((y) => y.is_current)?.id ?? ""}>
                    <option value="">Choose a year</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="name" label="Name" hint="For example Semester 1." required>
                  <Input />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField name="starts_on" label="Starts" required>
                    <Input type="date" />
                  </FormField>
                  <FormField name="ends_on" label="Ends" required>
                    <Input type="date" />
                  </FormField>
                  <FormField name="registration_opens_on" label="Registration opens">
                    <Input type="date" />
                  </FormField>
                  <FormField name="registration_closes_on" label="Registration closes">
                    <Input type="date" />
                  </FormField>
                </div>
                <label className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" name="is_current" className="size-5" />
                  Make this the current term
                </label>
                <div>
                  <SubmitButton>Add term</SubmitButton>
                </div>
              </ActionForm>
            )}
          </Section>
          <Section title="Add an academic year" id="add-year">
            <ActionForm
              action={createYear}
              aria-label="Add an academic year"
              className="rounded-xl border border-border bg-background p-5"
            >
              <FormField name="name" label="Name" hint="For example 2026/2027." required>
                <Input />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="starts_on" label="Starts" required>
                  <Input type="date" />
                </FormField>
                <FormField name="ends_on" label="Ends" required>
                  <Input type="date" />
                </FormField>
              </div>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="is_current" className="size-5" />
                Make this the current year
              </label>
              <div>
                <SubmitButton>Add year</SubmitButton>
              </div>
            </ActionForm>
            {years.length > 0 ? (
              <ul className="flex flex-col gap-1 text-ink-soft">
                {years.map((y) => (
                  <li key={y.id}>
                    {y.name}: {date(y.starts_on, tz)} to {date(y.ends_on, tz)}{" "}
                    {y.is_current ? <Badge variant="brand">Current</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
        </div>
      </div>
    </>
  );
}
