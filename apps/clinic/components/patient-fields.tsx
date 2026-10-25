import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";
import { FormField } from "./action-form";

export type PatientDefaults = {
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  sex?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  address?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  has_allergies?: boolean;
  allergy_notes?: string | null;
};

/** Demographics and allergies, for registration and edits (SPEC.md 8.2). */
export function PatientFields({ p = {}, today }: { p?: PatientDefaults; today: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField name="first_name" label="First name" required>
          <Input autoComplete="off" defaultValue={p.first_name ?? ""} />
        </FormField>
        <FormField name="middle_name" label="Middle name">
          <Input autoComplete="off" defaultValue={p.middle_name ?? ""} />
        </FormField>
        <FormField name="last_name" label="Last name" required>
          <Input autoComplete="off" defaultValue={p.last_name ?? ""} />
        </FormField>
        <FormField name="sex" label="Sex" required>
          <Select defaultValue={p.sex ?? ""}>
            <option value="">Choose</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </Select>
        </FormField>
        <FormField name="date_of_birth" label="Date of birth">
          <Input type="date" max={today} defaultValue={p.date_of_birth ?? ""} />
        </FormField>
        <FormField name="phone" label="Phone">
          <Input type="tel" autoComplete="off" defaultValue={p.phone ?? ""} />
        </FormField>
      </div>
      <FormField name="address" label="Address">
        <Input autoComplete="off" defaultValue={p.address ?? ""} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="next_of_kin_name" label="Next of kin">
          <Input autoComplete="off" defaultValue={p.next_of_kin_name ?? ""} />
        </FormField>
        <FormField name="next_of_kin_phone" label="Next of kin phone">
          <Input type="tel" autoComplete="off" defaultValue={p.next_of_kin_phone ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <FormField name="has_allergies" label="Allergies" required>
          <Select
            defaultValue={p.has_allergies === undefined ? "" : p.has_allergies ? "yes" : "no"}
          >
            <option value="">Choose</option>
            <option value="no">No known allergies</option>
            <option value="yes">Has allergies</option>
          </Select>
        </FormField>
        <FormField
          name="allergy_notes"
          label="Allergy details"
          hint="Required when the patient has allergies."
        >
          <Textarea rows={2} defaultValue={p.allergy_notes ?? ""} />
        </FormField>
      </div>
    </>
  );
}
