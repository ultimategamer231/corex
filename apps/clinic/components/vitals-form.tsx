import { Input } from "@corex/ui/components/input";
import { recordVitals } from "@/app/(app)/queue/actions";
import { ActionForm, FormField, SubmitButton } from "./action-form";

const FIELDS = [
  ["temperature_c", "Temperature (°C)", "decimal"],
  ["pulse_bpm", "Pulse (per minute)", "numeric"],
  ["bp_systolic", "Blood pressure, systolic", "numeric"],
  ["bp_diastolic", "Blood pressure, diastolic", "numeric"],
  ["resp_rate", "Breathing rate (per minute)", "numeric"],
  ["spo2", "Oxygen saturation (%)", "numeric"],
  ["weight_kg", "Weight (kg)", "decimal"],
  ["height_cm", "Height (cm)", "decimal"],
] as const;

/** Vitals for intake or a visit; empty measurements are left out. */
export function VitalsForm({
  patientId,
  encounterId,
}: {
  patientId: string;
  encounterId?: string;
}) {
  return (
    <ActionForm
      action={recordVitals}
      aria-label="Record vitals"
      className="max-w-3xl rounded-xl border border-border bg-background p-5"
    >
      <input type="hidden" name="id" value={crypto.randomUUID()} />
      <input type="hidden" name="patient_id" value={patientId} />
      {encounterId ? <input type="hidden" name="encounter_id" value={encounterId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([name, label, mode]) => (
          <FormField key={name} name={name} label={label}>
            <Input inputMode={mode} autoComplete="off" />
          </FormField>
        ))}
      </div>
      <div>
        <SubmitButton variant="secondary">Save vitals</SubmitButton>
      </div>
    </ActionForm>
  );
}
