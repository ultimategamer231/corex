import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PatientFields } from "@/components/patient-fields";
import { todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { FRONT_DESK } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { registerPatient } from "../actions";

export const metadata: Metadata = { title: "Register patient" };

export default async function NewPatientPage() {
  await requireRoles(FRONT_DESK);
  const settings = await getSettings();
  return (
    <>
      <PageHeader
        title="Register patient"
        description="The patient number is given when you save. Possible duplicates are flagged for review."
      />
      <ActionForm
        action={registerPatient}
        resetOnSuccess={false}
        aria-label="Register patient"
        className="max-w-3xl rounded-xl border border-border bg-background p-5"
      >
        <input type="hidden" name="id" value={crypto.randomUUID()} />
        <PatientFields today={todayIso(settings.timezone)} />
        <div>
          <SubmitButton variant="accent" pendingLabel="Registering...">
            Register patient
          </SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
