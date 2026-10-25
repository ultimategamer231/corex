import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { FormField } from "./action-form";

/** Clinician, date, time and length of an appointment. */
export function SlotFields({
  clinicians,
  defaults,
  today,
}: {
  clinicians: { id: string; name: string }[];
  defaults: { clinician_id?: string; date: string; time?: string; duration_minutes?: number };
  today: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField name="clinician_id" label="Clinician" required>
        <Select
          defaultValue={defaults.clinician_id ?? (clinicians.length === 1 ? clinicians[0]?.id : "")}
        >
          <option value="">Choose a clinician</option>
          {clinicians.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField name="date" label="Date" required>
        <Input type="date" min={today} defaultValue={defaults.date} />
      </FormField>
      <FormField name="time" label="Time" required>
        <Input type="time" step={300} defaultValue={defaults.time ?? ""} />
      </FormField>
      <FormField name="duration_minutes" label="Length (minutes)" required>
        <Input
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          step={5}
          defaultValue={defaults.duration_minutes ?? 20}
        />
      </FormField>
    </div>
  );
}
