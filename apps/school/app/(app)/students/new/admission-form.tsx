"use client";

import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";
import { ActionForm, FormField, SubmitButton, useFormResult } from "@/components/action-form";
import { admitStudent } from "../actions";

type Option = { id: string; label: string };

function DuplicateConfirm() {
  const result = useFormResult();
  if (!result.data?.duplicates) return null;
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-warning bg-warning-subtle px-4 font-medium text-warning">
      <input type="checkbox" name="confirm_duplicate" value="yes" className="size-5" />
      This is a different person. Admit anyway.
    </label>
  );
}

export function AdmissionForm({
  sections,
  programs,
  terms,
  defaultTerm,
}: {
  /** High School: sections to place the student in; College: undefined. */
  sections?: Option[];
  programs: Option[];
  terms: Option[];
  defaultTerm?: string;
}) {
  return (
    <ActionForm
      action={admitStudent}
      resetOnSuccess={false}
      aria-label="Admit a student"
      className="max-w-3xl"
    >
      <fieldset className="grid gap-4 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
        <legend className="px-1 text-lg font-bold">Student</legend>
        <FormField name="first_name" label="First name" required>
          <Input autoComplete="off" />
        </FormField>
        <FormField name="middle_name" label="Middle name">
          <Input autoComplete="off" />
        </FormField>
        <FormField name="last_name" label="Last name" required>
          <Input autoComplete="off" />
        </FormField>
        <FormField name="sex" label="Sex">
          <Select defaultValue="">
            <option value="">Not given</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </Select>
        </FormField>
        <FormField name="date_of_birth" label="Date of birth">
          <Input type="date" />
        </FormField>
        <FormField name="phone" label="Phone">
          <Input type="tel" />
        </FormField>
        <FormField name="email" label="Email">
          <Input type="email" />
        </FormField>
        <FormField name="address" label="Address" className="sm:col-span-2">
          <Textarea rows={2} />
        </FormField>
      </fieldset>
      {sections ? (
        <fieldset className="grid gap-4 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
          <legend className="px-1 text-lg font-bold">Class</legend>
          <FormField name="section_id" label="Grade and section" required>
            <Select defaultValue="">
              <option value="">Choose a class</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormField>
        </fieldset>
      ) : (
        <fieldset className="grid gap-4 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
          <legend className="px-1 text-lg font-bold">Program</legend>
          <FormField name="program_id" label="Program" required>
            <Select defaultValue="">
              <option value="">Choose a program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField name="start_term_id" label="Start term" required>
            <Select defaultValue={defaultTerm ?? ""}>
              <option value="">Choose a term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </FormField>
        </fieldset>
      )}
      <fieldset className="grid gap-4 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
        <legend className="px-1 text-lg font-bold">Guardian (optional)</legend>
        <FormField name="guardian_first_name" label="First name">
          <Input autoComplete="off" />
        </FormField>
        <FormField name="guardian_last_name" label="Last name">
          <Input autoComplete="off" />
        </FormField>
        <FormField name="guardian_relationship" label="Relationship">
          <Input placeholder="Mother, uncle, sponsor..." />
        </FormField>
        <FormField name="guardian_phone" label="Phone">
          <Input type="tel" />
        </FormField>
      </fieldset>
      <DuplicateConfirm />
      <div>
        <SubmitButton variant="accent" size="lg">
          Admit student
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
