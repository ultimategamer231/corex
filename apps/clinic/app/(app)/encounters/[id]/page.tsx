import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { PageHeader } from "@corex/ui/components/page-header";
import { Textarea } from "@corex/ui/components/textarea";
import { formatDateTime } from "@corex/core/dates";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { AllergyBanner } from "@/components/patient-picker";
import { Section } from "@/components/section";
import { PendingRecords } from "@/components/pending";
import { VitalsForm } from "@/components/vitals-form";
import { VitalsTable } from "@/components/vitals-table";
import { ageText, loadClinicians, SEX } from "@/lib/clinic";
import { personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { CLINICAL, CLINICIAN } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { amendNote, closeVisit, deleteDraft, saveNote, signNote } from "../actions";

export const metadata: Metadata = { title: "Visit" };

const NOTE_FIELDS = [
  ["complaints", "Presenting complaints", 2],
  ["history", "History", 3],
  ["examination", "Examination", 3],
  ["assessment", "Assessment (diagnosis)", 2],
  ["plan", "Plan", 3],
  ["prescriptions_text", "Prescriptions", 3],
] as const;

type Note = {
  id: string;
  version: number;
  supersedes_id: string | null;
  author_id: string;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
} & Record<(typeof NOTE_FIELDS)[number][0], string | null>;

/**
 * The visit: vitals for clinical staff, notes for clinicians (CLN-01). Notes are
 * drafted, signed, and corrected only through new versions (CLN-03).
 */
export default async function EncounterPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, member } = await requireRoles(CLINICAL);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const tz = settings.timezone;
  const encounter = await supabase
    .from("encounters")
    .select(
      "id, status, opened_at, closed_at, clinician_id, patients(id, patient_number, first_name, middle_name, last_name, sex, date_of_birth, has_allergies, allergy_notes)",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  const p = encounter?.patients;
  if (!encounter || !p) notFound();
  const logged = await supabase.rpc("log_view", { p_table_name: "encounters", p_record_id: id });
  if (logged.error) throw new Error(logged.error.message);

  const isClinician = memberHas(member, CLINICIAN);
  const [vitals, notes, clinicians] = await Promise.all([
    supabase
      .from("vitals")
      .select(
        "id, recorded_at, temperature_c, pulse_bpm, bp_systolic, bp_diastolic, resp_rate, spo2, weight_kg, height_cm",
      )
      .eq("encounter_id", id)
      .order("recorded_at", { ascending: false })
      .then(rows),
    isClinician
      ? supabase
          .from("clinical_notes")
          .select(
            "id, version, supersedes_id, author_id, signed_at, created_at, updated_at, complaints, history, examination, assessment, plan, prescriptions_text",
          )
          .eq("encounter_id", id)
          .order("created_at")
          .then((r) => rows(r) as Note[])
      : Promise.resolve([] as Note[]),
    loadClinicians(supabase),
  ]);
  const name = new Map(clinicians.map((c) => [c.id, c.name]));
  const supersededBy = new Map(
    notes.filter((n) => n.supersedes_id).map((n) => [n.supersedes_id, n]),
  );
  const myDraft = notes.find((n) => !n.signed_at && n.author_id === member.userId);
  const current = notes.filter((n) => n.signed_at && !supersededBy.get(n.id)?.signed_at);
  const open = encounter.status === "open";
  const facts = [
    p.sex ? SEX[p.sex as keyof typeof SEX] : null,
    ageText(p.date_of_birth, todayIso(tz)),
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={`Visit: ${personName(p)}`}
        description={`${p.patient_number}${facts.length ? ` · ${facts.join(", ")}` : ""} · opened ${formatDateTime(encounter.opened_at, tz)} · ${name.get(encounter.clinician_id) ?? "Former clinician"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={open ? "brand" : "neutral"}>{open ? "Open" : "Closed"}</Badge>
            <Link
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              href={`/patients/${p.id}`}
            >
              Patient record
            </Link>
          </div>
        }
      />
      <div className="flex flex-col gap-10">
        <AllergyBanner hasAllergies={p.has_allergies} notes={p.allergy_notes} />

        <Section title="Vitals" id="vitals">
          <VitalsTable vitals={vitals} timezone={tz} />
          <PendingRecords table="vitals" label="Vitals waiting to sync" patientId={p.id} />
          {open ? <VitalsForm patientId={p.id} encounterId={id} /> : null}
        </Section>

        {isClinician ? (
          <Section
            title="Clinical notes"
            id="notes"
            description="Signed notes cannot be edited. A correction becomes a new version."
          >
            {current.map((n) => (
              <article
                key={n.id}
                className="max-w-3xl rounded-xl border border-border bg-background p-5"
              >
                <NoteBody note={n} />
                <p className="mt-3 text-sm text-muted">
                  Version {n.version}, signed by {name.get(n.author_id) ?? "former clinician"} on{" "}
                  {formatDateTime(n.signed_at ?? n.created_at, tz)}
                </p>
                {open && !supersededBy.get(n.id) ? (
                  <div className="mt-3">
                    <ConfirmAction
                      action={amendNote}
                      fields={{ id: n.id }}
                      triggerLabel="Add a correction"
                      title="Correct this signed note?"
                      description="A new draft version starts from this note. The signed version stays in the history."
                      confirmLabel="Start correction"
                      variant="primary"
                    />
                  </div>
                ) : null}
              </article>
            ))}

            {open ? (
              <div className="flex max-w-3xl flex-col gap-3">
                <ActionForm
                  action={saveNote}
                  resetOnSuccess={false}
                  aria-label={myDraft ? `Draft note, version ${myDraft.version}` : "New note"}
                  className="rounded-xl border border-border bg-background p-5"
                >
                  <h3 className="text-lg font-bold">
                    {myDraft
                      ? myDraft.supersedes_id
                        ? `Correction draft (version ${myDraft.version})`
                        : "Draft note"
                      : "New note"}
                  </h3>
                  <input type="hidden" name="encounter_id" value={id} />
                  {myDraft ? <input type="hidden" name="note_id" value={myDraft.id} /> : null}
                  {NOTE_FIELDS.map(([field, label, lines]) => (
                    <FormField key={field} name={field} label={label}>
                      <Textarea rows={lines} defaultValue={myDraft?.[field] ?? ""} />
                    </FormField>
                  ))}
                  <div>
                    <SubmitButton variant="secondary">Save draft</SubmitButton>
                  </div>
                </ActionForm>
                {myDraft ? (
                  <div className="flex flex-wrap gap-2">
                    <ConfirmAction
                      action={signNote}
                      fields={{ id: myDraft.id }}
                      triggerLabel="Sign note"
                      triggerVariant="accent"
                      triggerSize="md"
                      title="Sign this note?"
                      description="Save your latest changes first. Once signed, the note cannot be edited; corrections become new versions."
                      confirmLabel="Sign note"
                      variant="primary"
                    />
                    <ConfirmAction
                      action={deleteDraft}
                      fields={{ id: myDraft.id }}
                      triggerLabel="Delete draft"
                      triggerSize="md"
                      title="Delete this draft?"
                      description="Unsigned drafts can be deleted. Signed notes are never deleted."
                      confirmLabel="Delete draft"
                    />
                  </div>
                ) : null}
              </div>
            ) : current.length === 0 ? (
              <p className="text-muted">No signed notes for this visit.</p>
            ) : null}

            {notes.some((n) => n.supersedes_id) ? (
              <details className="max-w-3xl">
                <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                  Version history ({notes.length} versions)
                </summary>
                <ol className="mt-2 flex flex-col gap-3">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="mb-2 text-sm font-semibold">
                        Version {n.version} by {name.get(n.author_id) ?? "former clinician"}:{" "}
                        {n.signed_at ? `signed ${formatDateTime(n.signed_at, tz)}` : "draft"}
                        {supersededBy.get(n.id)
                          ? `, corrected by version ${supersededBy.get(n.id)?.version}`
                          : ""}
                      </p>
                      <NoteBody note={n} />
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </Section>
        ) : null}

        {isClinician && open ? (
          <div>
            {notes.some((n) => !n.signed_at) ? (
              <Alert tone="info" className="mb-3 max-w-3xl">
                Sign or delete draft notes before closing the visit.
              </Alert>
            ) : null}
            <ConfirmAction
              action={closeVisit}
              fields={{ id }}
              triggerLabel="Close visit"
              triggerVariant="primary"
              triggerSize="md"
              title="Close this visit?"
              description="The patient leaves the queue and the cashier can bill the visit."
              confirmLabel="Close visit"
              variant="primary"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

function NoteBody({ note }: { note: Note }) {
  const filled = NOTE_FIELDS.filter(([field]) => note[field]);
  if (filled.length === 0) return <p className="text-muted">Empty note.</p>;
  return (
    <dl className="flex flex-col gap-2">
      {filled.map(([field, label]) => (
        <div key={field}>
          <dt className="text-sm font-semibold text-muted">{label}</dt>
          <dd className="whitespace-pre-line">{note[field]}</dd>
        </div>
      ))}
    </dl>
  );
}
