import { personName } from "./format";
import { rows } from "./queries";
import type { ClinicDb } from "./supabase";

/** Patient names for bills, which reference patients by `party_id`. */
export async function patientNames(db: ClinicDb, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const list = rows(
    await db
      .from("patients")
      .select("id, first_name, middle_name, last_name, patient_number")
      .in("id", unique),
  );
  return new Map(list.map((p) => [p.id, `${personName(p)} (${p.patient_number})`]));
}

/** Total and amount paid per bill. */
export async function balances(
  db: ClinicDb,
  ids: string[],
): Promise<Map<string, { total: number; paid: number }>> {
  if (ids.length === 0) return new Map();
  const list = rows(
    await db
      .from("invoice_balances")
      .select("invoice_id, total_minor, paid_minor")
      .in("invoice_id", ids),
  );
  return new Map(
    list.map((b) => [
      b.invoice_id ?? "",
      { total: Number(b.total_minor ?? 0), paid: Number(b.paid_minor ?? 0) },
    ]),
  );
}
