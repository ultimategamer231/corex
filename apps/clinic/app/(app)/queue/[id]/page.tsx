import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AllergyBanner } from "@/components/patient-picker";
import { Section } from "@/components/section";
import { VitalsForm } from "@/components/vitals-form";
import { VitalsTable } from "@/components/vitals-table";
import { ageText, queueStatus, SEX, timeOf } from "@/lib/clinic";
import { personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { CLINICAL, CLINICIAN, FRONT_DESK } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { startVisit } from "../actions";

export const metadata: Metadata = { title: "Intake" };

/** One queued patient: intake vitals for clinical staff, then the clinician opens the visit. */
export default async function QueueEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, member } = await requireRoles(FRONT_DESK);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const tz = settings.timezone;
  const entry = await supabase
    .from("queue_entries")
    .select(
      "id, arrived_at, status, encounter_id, patients(id, patient_number, first_name, middle_name, last_name, sex, date_of_birth, has_allergies, allergy_notes)",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  const p = entry?.patients;
  if (!entry || !p) notFound();
  const clinical = memberHas(member, CLINICAL);
  if (clinical) {
    const logged = await supabase.rpc("log_view", { p_table_name: "patients", p_record_id: p.id });
    if (logged.error) throw new Error(logged.error.message);
  }
  const vitals = clinical
    ? await supabase
        .from("vitals")
        .select(
          "id, recorded_at, temperature_c, pulse_bpm, bp_systolic, bp_diastolic, resp_rate, spo2, weight_kg, height_cm",
        )
        .eq("patient_id", p.id)
        .gte("recorded_at", new Date(Date.parse(entry.arrived_at) - 3_600_000).toISOString())
        .order("recorded_at", { ascending: false })
        .then(rows)
    : [];
  const s = queueStatus(entry.status);
  const facts = [
    p.sex ? SEX[p.sex as keyof typeof SEX] : null,
    ageText(p.date_of_birth, todayIso(tz)),
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={personName(p)}
        description={`${p.patient_number}${facts.length ? ` · ${facts.join(", ")}` : ""} · arrived ${timeOf(entry.arrived_at, tz)}`}
        actions={<Badge variant={s.variant}>{s.label}</Badge>}
      />
      <div className="flex flex-col gap-10">
        <AllergyBanner hasAllergies={p.has_allergies} notes={p.allergy_notes} />
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ variant: "secondary", size: "sm" })}
            href={`/patients/${p.id}`}
          >
            Patient record
          </Link>
          {entry.encounter_id && clinical ? (
            <Link
              className={buttonVariants({ variant: "primary", size: "sm" })}
              href={`/encounters/${entry.encounter_id}`}
            >
              Open visit
            </Link>
          ) : null}
          {!entry.encounter_id && entry.status !== "done" && memberHas(member, CLINICIAN) ? (
            <ActionForm action={startVisit} aria-label="Start visit">
              <input type="hidden" name="id" value={id} />
              <SubmitButton variant="accent" pendingLabel="Opening...">
                Start visit
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
        {clinical ? (
          <Section
            title="Intake vitals"
            id="vitals"
            description="Vitals taken now are added to the visit when it opens."
          >
            <VitalsTable vitals={vitals} timezone={tz} />
            {entry.status !== "done" ? (
              <VitalsForm patientId={p.id} encounterId={entry.encounter_id ?? undefined} />
            ) : null}
          </Section>
        ) : null}
      </div>
    </>
  );
}
