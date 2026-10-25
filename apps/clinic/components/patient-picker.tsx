import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import Link from "next/link";
import { date, personName } from "@/lib/format";
import { searchPatients } from "@/lib/patients";
import { rows } from "@/lib/queries";
import type { ClinicDb } from "@/lib/supabase";

/**
 * Find a patient, then choose one: the choice is a link to `basePath` with
 * `?patient=<id>` and the other `keep` parameters, so it works without JavaScript.
 */
export async function PatientPicker({
  db,
  basePath,
  q,
  keep = {},
  timezone,
  canRegister = true,
}: {
  db: ClinicDb;
  basePath: string;
  q: string | undefined;
  keep?: Record<string, string>;
  timezone: string;
  /** Front desk staff can register a patient who is not found. */
  canRegister?: boolean;
}) {
  const results = q?.trim() ? rows(await searchPatients(db, q, 10)) : [];
  const hrefFor = (id: string) =>
    `${basePath}?${new URLSearchParams({ ...keep, patient: id }).toString()}`;
  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-end gap-3" aria-label="Find a patient">
        {Object.entries(keep).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="flex w-80 max-w-full flex-col gap-1.5">
          <Label htmlFor="patient-q">Find a patient</Label>
          <Input
            id="patient-q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Name, patient number or phone"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {q?.trim() ? (
        results.length === 0 ? (
          <p className="text-muted">
            No patient matches. Check the spelling
            {canRegister ? (
              <>
                {" "}
                or{" "}
                <Link className="font-semibold text-primary underline" href="/patients/new">
                  register the patient
                </Link>
              </>
            ) : null}
            .
          </p>
        ) : (
          <TableScroll label="Matching patients">
            <Table>
              <thead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Number</Th>
                  <Th>Date of birth</Th>
                  <Th>Phone</Th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link
                        className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                        href={hrefFor(p.id)}
                      >
                        Choose {personName(p)}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{p.patient_number}</Td>
                    <Td className="whitespace-nowrap">
                      {p.date_of_birth ? date(p.date_of_birth, timezone) : "-"}
                    </Td>
                    <Td className="whitespace-nowrap">{p.phone ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )
      ) : null}
    </div>
  );
}

/** The chosen patient, with a link back to choose another. */
export function ChosenPatient({
  name,
  number,
  changeHref,
}: {
  name: string;
  number: string;
  changeHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <p>
        <span className="font-bold">{name}</span> <span className="text-muted">{number}</span>
      </p>
      <Link
        className="inline-flex min-h-11 items-center font-semibold text-primary underline"
        href={changeHref}
      >
        Choose another patient
      </Link>
    </div>
  );
}

/** Allergies, shown on every screen about the patient (SPEC.md 8.4). */
export function AllergyBanner({
  hasAllergies,
  notes,
}: {
  hasAllergies: boolean;
  notes: string | null;
}) {
  if (!hasAllergies) return null;
  return (
    <div role="note" className="rounded-lg bg-danger-subtle px-4 py-3 font-bold text-danger">
      Allergies: {notes}
    </div>
  );
}
