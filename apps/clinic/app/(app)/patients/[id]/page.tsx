import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { formatDateTime } from "@corex/core/dates";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { AllergyBanner } from "@/components/patient-picker";
import { Section } from "@/components/section";
import { VitalsTable } from "@/components/vitals-table";
import { ageText, appointmentStatus, loadClinicians, SEX } from "@/lib/clinic";
import { maxAttachmentBytes } from "@/lib/files";
import { date, personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { invoiceStatus } from "@/lib/invoices";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { BILLING, CLINICAL, CLINICIAN, FRONT_DESK } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";
import { attachFile } from "../actions";

export const metadata: Metadata = { title: "Patient" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ registered?: string }>;
};

const link = "inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline";

export default async function PatientPage({ params, searchParams }: Props) {
  const { supabase, member } = await getSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { registered } = await searchParams;
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayIso(tz);
  const clinical = memberHas(member, CLINICAL);
  const clinician = memberHas(member, CLINICIAN);
  const frontDesk = memberHas(member, FRONT_DESK);
  const billing = memberHas(member, BILLING);

  const patient = await supabase
    .from("patients")
    .select(
      "id, patient_number, first_name, middle_name, last_name, sex, date_of_birth, phone, address, next_of_kin_name, next_of_kin_phone, has_allergies, allergy_notes, possible_duplicate_of, created_at",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!patient) notFound();
  // Opening the clinical record is audited on the server (CLN-02).
  if (clinical) {
    const logged = await supabase.rpc("log_view", { p_table_name: "patients", p_record_id: id });
    if (logged.error) throw new Error(logged.error.message);
  }

  const [duplicate, appointments, encounters, vitals, files, bills, clinicians] = await Promise.all(
    [
      patient.possible_duplicate_of
        ? supabase
            .from("patients")
            .select("id, patient_number, first_name, middle_name, last_name")
            .eq("id", patient.possible_duplicate_of)
            .maybeSingle()
            .then(rows)
        : Promise.resolve(null),
      supabase
        .from("appointments")
        .select("id, starts_at, duration_minutes, clinician_id, reason, status, cancel_reason")
        .eq("patient_id", id)
        .order("starts_at", { ascending: false })
        .limit(20)
        .then(rows),
      supabase
        .from("encounters")
        .select("id, opened_at, closed_at, status, clinician_id")
        .eq("patient_id", id)
        .order("opened_at", { ascending: false })
        .limit(20)
        .then(rows),
      clinical
        ? supabase
            .from("vitals")
            .select(
              "id, recorded_at, temperature_c, pulse_bpm, bp_systolic, bp_diastolic, resp_rate, weight_kg, height_cm, spo2",
            )
            .eq("patient_id", id)
            .order("recorded_at", { ascending: false })
            .limit(5)
            .then(rows)
        : Promise.resolve([]),
      clinical
        ? supabase
            .from("files")
            .select("id, bucket_path, mime_type, size_bytes, created_at")
            .eq("owner_table", "patients")
            .eq("owner_id", id)
            .order("created_at", { ascending: false })
            .then(rows)
        : Promise.resolve([]),
      billing
        ? supabase
            .from("invoices")
            .select("id, number, currency, status, created_at, payer_type")
            .eq("party_type", "patient")
            .eq("party_id", id)
            .order("created_at", { ascending: false })
            .limit(10)
            .then(rows)
        : Promise.resolve([]),
      loadClinicians(supabase),
    ],
  );
  const encounterIds = encounters.map((e) => e.id);
  const notes =
    clinician && encounterIds.length
      ? await supabase
          .from("clinical_notes")
          .select("encounter_id, assessment, version, signed_at")
          .in("encounter_id", encounterIds)
          .not("signed_at", "is", null)
          .order("version", { ascending: false })
          .then(rows)
      : [];
  const assessment = new Map<string, string | null>();
  for (const n of notes)
    if (!assessment.has(n.encounter_id)) assessment.set(n.encounter_id, n.assessment);
  const doctor = new Map(clinicians.map((c) => [c.id, c.name]));
  const name = personName(patient);
  const facts = [
    patient.sex ? SEX[patient.sex as keyof typeof SEX] : null,
    ageText(patient.date_of_birth, today),
    patient.date_of_birth ? `born ${date(patient.date_of_birth, tz)}` : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={name}
        description={`${patient.patient_number}${facts.length ? ` · ${facts.join(", ")}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {frontDesk ? (
              <>
                <Link
                  className={buttonVariants({ variant: "accent", size: "sm" })}
                  href={`/appointments/new?patient=${id}`}
                >
                  Book appointment
                </Link>
                <Link
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`/queue?patient=${id}`}
                >
                  Add to queue
                </Link>
                <Link
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`/patients/${id}/edit`}
                >
                  Edit details
                </Link>
              </>
            ) : null}
            {billing ? (
              <Link
                className={buttonVariants({ variant: "accent", size: "sm" })}
                href={`/billing/new?patient=${id}`}
              >
                New bill
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          {registered ? (
            <Alert tone="success">Patient registered as {patient.patient_number}.</Alert>
          ) : null}
          {duplicate ? (
            <Alert tone="warning">
              Possible duplicate of{" "}
              <Link className="font-bold underline" href={`/patients/${duplicate.id}`}>
                {personName(duplicate)} ({duplicate.patient_number})
              </Link>
              : same name and date of birth, or the same phone. Check before booking.
            </Alert>
          ) : null}
          <AllergyBanner hasAllergies={patient.has_allergies} notes={patient.allergy_notes} />
        </div>

        <Section title="Details" id="details">
          <dl className="grid max-w-3xl gap-x-6 gap-y-3 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
            {[
              ["Phone", patient.phone],
              ["Address", patient.address],
              ["Next of kin", patient.next_of_kin_name],
              ["Next of kin phone", patient.next_of_kin_phone],
              ["Allergies", patient.has_allergies ? patient.allergy_notes : "No known allergies"],
              ["Registered", date(patient.created_at, tz)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm font-semibold text-muted">{label}</dt>
                <dd>{value || "-"}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Visits" id="visits" description="Most recent first.">
          {encounters.length === 0 ? (
            <p className="text-muted">No visits yet.</p>
          ) : (
            <ol className="flex max-w-3xl flex-col gap-3">
              {encounters.map((e) => (
                <li key={e.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {clinical ? (
                      <Link className={link} href={`/encounters/${e.id}`}>
                        {formatDateTime(e.opened_at, tz)}
                      </Link>
                    ) : (
                      <span className="font-semibold">{formatDateTime(e.opened_at, tz)}</span>
                    )}
                    <Badge variant={e.status === "open" ? "brand" : "neutral"}>
                      {e.status === "open" ? "Open" : "Closed"}
                    </Badge>
                  </div>
                  <p className="text-[15px] text-ink-soft">
                    {doctor.get(e.clinician_id) ?? "Former clinician"}
                  </p>
                  {clinician && assessment.get(e.id) ? (
                    <p className="mt-1">
                      <span className="font-semibold">Assessment:</span> {assessment.get(e.id)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Section>

        {clinical ? (
          <Section title="Recent vitals" id="vitals">
            <VitalsTable vitals={vitals} timezone={tz} />
          </Section>
        ) : null}

        <Section
          title="Appointments"
          id="appointments"
          description="Cancelled appointments stay on record."
        >
          {appointments.length === 0 ? (
            <p className="text-muted">No appointments.</p>
          ) : (
            <TableScroll label="Appointments">
              <Table>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Clinician</Th>
                    <Th>Reason</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => {
                    const s = appointmentStatus(a.status);
                    return (
                      <tr key={a.id}>
                        <Td className="whitespace-nowrap">
                          <Link className={link} href={`/appointments/${a.id}`}>
                            {formatDateTime(a.starts_at, tz)}
                          </Link>
                        </Td>
                        <Td>{doctor.get(a.clinician_id) ?? "Former clinician"}</Td>
                        <Td>
                          {a.reason ?? "-"}
                          {a.cancel_reason ? (
                            <p className="text-sm text-muted">Cancelled: {a.cancel_reason}</p>
                          ) : null}
                        </Td>
                        <Td>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>

        {clinical ? (
          <Section
            title="Files"
            id="files"
            description="Lab results, scans and letters. Only clinical staff can open them."
          >
            {files.length === 0 ? (
              <p className="text-muted">No files attached.</p>
            ) : (
              <ul className="flex max-w-3xl flex-col divide-y divide-border rounded-xl border border-border bg-background">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
                  >
                    <a
                      className={link}
                      href={`/patients/${id}/files/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {f.mime_type === "application/pdf" ? "PDF" : "Image"} added{" "}
                      {formatDateTime(f.created_at, tz)}
                    </a>
                    <span className="text-sm text-muted">
                      {Math.max(1, Math.round(Number(f.size_bytes) / 1000))} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm
              action={attachFile}
              aria-label="Attach a file"
              className="flex max-w-3xl flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-5"
            >
              <input type="hidden" name="patient_id" value={id} />
              <FormField
                name="file"
                label="File"
                required
                hint={`PDF, JPG or PNG, up to ${maxAttachmentBytes() / 1_000_000} MB.`}
                className="w-80 max-w-full"
              >
                <Input type="file" accept="application/pdf,image/jpeg,image/png" />
              </FormField>
              <SubmitButton variant="secondary" pendingLabel="Uploading...">
                Attach file
              </SubmitButton>
            </ActionForm>
          </Section>
        ) : null}

        {billing ? (
          <Section title="Bills" id="bills">
            {bills.length === 0 ? (
              <p className="text-muted">No bills yet.</p>
            ) : (
              <TableScroll label="Bills">
                <Table>
                  <thead>
                    <tr>
                      <Th>Bill</Th>
                      <Th>Date</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b) => {
                      const s = invoiceStatus(b.status);
                      return (
                        <tr key={b.id}>
                          <Td>
                            <Link className={link} href={`/billing/${b.id}`}>
                              {b.number ? `No. ${b.number}` : "Draft"} ({b.currency})
                            </Link>
                          </Td>
                          <Td className="whitespace-nowrap">{date(b.created_at, tz)}</Td>
                          <Td>
                            <Badge variant={s.variant}>{s.label}</Badge>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableScroll>
            )}
          </Section>
        ) : null}
      </div>
    </>
  );
}
