import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { formatDateTime } from "@corex/core/dates";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ChosenPatient, PatientPicker } from "@/components/patient-picker";
import { PAYERS } from "@/lib/clinic";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { loadPatient } from "@/lib/patients";
import { rows } from "@/lib/queries";
import { BILLING } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createBill } from "../actions";

export const metadata: Metadata = { title: "New bill" };

type Props = { searchParams: Promise<{ patient?: string; encounter?: string; q?: string }> };

export default async function NewBillPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(BILLING);
  const settings = await getSettings();
  const params = await searchParams;
  const patient = isUuid(params.patient) ? await loadPatient(supabase, params.patient) : null;
  const visits = patient
    ? await supabase
        .from("encounters")
        .select("id, opened_at")
        .eq("patient_id", patient.id)
        .order("opened_at", { ascending: false })
        .limit(10)
        .then(rows)
    : [];
  const encounter = visits.find((v) => v.id === params.encounter)?.id ?? visits[0]?.id ?? "";

  return (
    <>
      <PageHeader title="New bill" description="Add services after creating the bill." />
      <div className="flex max-w-3xl flex-col gap-6">
        {patient ? (
          <>
            <ChosenPatient
              name={personName(patient)}
              number={patient.patient_number}
              changeHref="/billing/new"
            />
            <ActionForm
              action={createBill}
              resetOnSuccess={false}
              aria-label="New bill"
              className="rounded-xl border border-border bg-background p-5"
            >
              <input type="hidden" name="patient_id" value={patient.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="encounter_id" label="Visit">
                  <Select defaultValue={encounter}>
                    <option value="">Not for a visit</option>
                    {visits.map((v) => (
                      <option key={v.id} value={v.id}>
                        {formatDateTime(v.opened_at, settings.timezone)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="currency" label="Currency" required>
                  <Select defaultValue={settings.baseCurrency}>
                    <option value="USD">USD</option>
                    <option value="LRD">LRD</option>
                  </Select>
                </FormField>
                <FormField name="payer_type" label="Who pays" required>
                  <Select defaultValue="self">
                    {Object.entries(PAYERS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  name="payer_name"
                  label="Insurer or company"
                  hint="Required unless the patient pays."
                >
                  <Input autoComplete="off" />
                </FormField>
              </div>
              <FormField name="notes" label="Notes">
                <Input autoComplete="off" />
              </FormField>
              <div>
                <SubmitButton variant="accent">Create bill</SubmitButton>
              </div>
            </ActionForm>
          </>
        ) : (
          <PatientPicker
            db={supabase}
            basePath="/billing/new"
            canRegister={false}
            q={params.q}
            timezone={settings.timezone}
          />
        )}
      </div>
    </>
  );
}
