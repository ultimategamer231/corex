import { PATIENT_COLUMNS } from "./clinic";
import { rows } from "./queries";
import type { ClinicDb } from "./supabase";

export type PatientRow = {
  id: string;
  patient_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  sex: string | null;
  date_of_birth: string | null;
  phone: string | null;
  has_allergies: boolean;
  allergy_notes: string | null;
  possible_duplicate_of: string | null;
};

/** Characters that would change a PostgREST filter; search text never needs them. */
export function searchTerm(q: string | undefined): string {
  return (q ?? "")
    .replace(/[,()%*\\:."']/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Patients matching a name, patient number or phone number. Each word must match the
 * first, middle or last name; a number matches the patient number or phone.
 */
export function searchPatients(db: ClinicDb, q: string, limit = 25, offset = 0) {
  let query = db
    .from("patients")
    .select(PATIENT_COLUMNS, { count: "exact" })
    .order("last_name")
    .order("first_name")
    .range(offset, offset + limit - 1);
  const term = searchTerm(q);
  if (term) {
    const words = term.split(/\s+/).filter(Boolean).slice(0, 3);
    for (const w of words) {
      const digits = w.replace(/\D/g, "");
      query = query.or(
        [
          `first_name.ilike.${w}%`,
          `middle_name.ilike.${w}%`,
          `last_name.ilike.${w}%`,
          `patient_number.ilike.%${w}%`,
          ...(digits.length >= 4 ? [`phone.ilike.%${digits}%`] : []),
        ].join(","),
      );
    }
  }
  return query;
}

export async function loadPatient(db: ClinicDb, id: string): Promise<PatientRow | null> {
  return db.from("patients").select(PATIENT_COLUMNS).eq("id", id).maybeSingle().then(rows);
}
