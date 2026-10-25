import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PatientFields } from "@/components/patient-fields";
import { personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { FRONT_DESK } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { updatePatient } from "../../actions";

export const metadata: Metadata = { title: "Edit patient" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRoles(FRONT_DESK);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const patient = await supabase
    .from("patients")
    .select(
      "id, patient_number, first_name, middle_name, last_name, sex, date_of_birth, phone, address, next_of_kin_name, next_of_kin_phone, has_allergies, allergy_notes",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!patient) notFound();
  return (
    <>
      <PageHeader title={`Edit ${personName(patient)}`} description={patient.patient_number} />
      <ActionForm
        action={updatePatient}
        resetOnSuccess={false}
        aria-label="Edit patient"
        className="max-w-3xl rounded-xl border border-border bg-background p-5"
      >
        <input type="hidden" name="id" value={id} />
        <PatientFields p={patient} today={todayIso(settings.timezone)} />
        <div>
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
