import { PageHeader } from "@corex/ui/components/page-header";
import { Textarea } from "@corex/ui/components/textarea";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { AllergyBanner, ChosenPatient, PatientPicker } from "@/components/patient-picker";
import { SlotFields } from "@/components/slot-fields";
import { loadClinicians } from "@/lib/clinic";
import { personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { loadPatient } from "@/lib/patients";
import { FRONT_DESK } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { bookAppointment } from "../actions";

export const metadata: Metadata = { title: "Book appointment" };

type Props = { searchParams: Promise<{ patient?: string; q?: string; date?: string }> };

export default async function NewAppointmentPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(FRONT_DESK);
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const params = await searchParams;
  const day =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date >= today
      ? params.date
      : today;
  const patient = isUuid(params.patient) ? await loadPatient(supabase, params.patient) : null;
  const clinicians = await loadClinicians(supabase);

  return (
    <>
      <PageHeader title="Book appointment" description="A clinician sees one patient at a time." />
      <div className="flex max-w-3xl flex-col gap-6">
        {patient ? (
          <>
            <ChosenPatient
              name={personName(patient)}
              number={patient.patient_number}
              changeHref={`/appointments/new?date=${day}`}
            />
            <AllergyBanner hasAllergies={patient.has_allergies} notes={patient.allergy_notes} />
            <ActionForm
              action={bookAppointment}
              resetOnSuccess={false}
              aria-label="Book appointment"
              className="rounded-xl border border-border bg-background p-5"
            >
              <input type="hidden" name="patient_id" value={patient.id} />
              <SlotFields clinicians={clinicians} defaults={{ date: day }} today={today} />
              <FormField name="reason" label="Reason">
                <Textarea rows={2} />
              </FormField>
              <div>
                <SubmitButton variant="accent" pendingLabel="Booking...">
                  Book appointment
                </SubmitButton>
              </div>
            </ActionForm>
          </>
        ) : (
          <PatientPicker
            db={supabase}
            basePath="/appointments/new"
            q={params.q}
            keep={{ date: day }}
            timezone={settings.timezone}
          />
        )}
      </div>
    </>
  );
}
