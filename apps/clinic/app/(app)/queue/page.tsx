import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { ListOrdered } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { AllergyBanner, ChosenPatient, PatientPicker } from "@/components/patient-picker";
import { Section } from "@/components/section";
import { dayBounds, queueStatus, timeOf } from "@/lib/clinic";
import { personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { loadPatient } from "@/lib/patients";
import { rows } from "@/lib/queries";
import { CLINICAL, CLINICIAN, FRONT_DESK } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { addWalkIn, setQueueStatus, startVisit } from "./actions";

export const metadata: Metadata = { title: "Queue" };

type Props = { searchParams: Promise<{ patient?: string; q?: string }> };

export default async function QueuePage({ searchParams }: Props) {
  const { supabase, member } = await requireRoles(FRONT_DESK);
  const clinician = memberHas(member, CLINICIAN);
  const clinical = memberHas(member, CLINICAL);
  const settings = await getSettings();
  const tz = settings.timezone;
  const params = await searchParams;
  const bounds = dayBounds(todayIso(tz), tz);
  const [entries, chosen] = await Promise.all([
    supabase
      .from("queue_entries")
      .select(
        "id, arrived_at, status, appointment_id, encounter_id, patients(id, patient_number, first_name, middle_name, last_name, has_allergies)",
      )
      .or(`status.neq.done,arrived_at.gte."${bounds.start}"`)
      .order("arrived_at")
      .limit(200)
      .then(rows),
    isUuid(params.patient) ? loadPatient(supabase, params.patient) : Promise.resolve(null),
  ]);
  const active = entries.filter((e) => e.status !== "done");
  const done = entries.filter((e) => e.status === "done");

  return (
    <>
      <PageHeader
        title="Queue"
        description={`${active.length} waiting or being seen. Patients with appointments join when checked in.`}
      />
      <div className="flex flex-col gap-10">
        <Section title="Add a walk-in" id="walk-in">
          <div className="flex max-w-3xl flex-col gap-4">
            {chosen ? (
              <>
                <ChosenPatient
                  name={personName(chosen)}
                  number={chosen.patient_number}
                  changeHref="/queue"
                />
                <AllergyBanner hasAllergies={chosen.has_allergies} notes={chosen.allergy_notes} />
                <ActionForm action={addWalkIn} aria-label="Add to the queue">
                  <input type="hidden" name="patient_id" value={chosen.id} />
                  <div>
                    <SubmitButton variant="accent">
                      Add {personName(chosen)} to the queue
                    </SubmitButton>
                  </div>
                </ActionForm>
              </>
            ) : (
              <PatientPicker db={supabase} basePath="/queue" q={params.q} timezone={tz} />
            )}
          </div>
        </Section>

        <Section title="Waiting and being seen" id="active">
          {active.length === 0 ? (
            <EmptyState
              icon={<ListOrdered />}
              title="No one is waiting"
              description="Check in an appointment or add a walk-in."
            />
          ) : (
            <ol className="flex max-w-3xl flex-col gap-2">
              {active.map((e, i) => {
                const s = queueStatus(e.status);
                const p = e.patients;
                return (
                  <li
                    key={e.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>
                        <span className="mr-2 font-display font-bold">{i + 1}.</span>
                        {p ? (
                          <Link
                            className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                            href={`/queue/${e.id}`}
                          >
                            {personName(p)}
                          </Link>
                        ) : null}{" "}
                        <span className="text-sm text-muted">{p?.patient_number}</span>
                        {p?.has_allergies ? (
                          <Badge variant="danger" className="ml-2">
                            Allergies
                          </Badge>
                        ) : null}
                      </p>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <p className="text-sm text-ink-soft">
                      Arrived {timeOf(e.arrived_at, tz)} ·{" "}
                      {e.appointment_id ? "Appointment" : "Walk-in"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {clinical && !e.encounter_id ? (
                        <Link
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                          href={`/queue/${e.id}`}
                        >
                          Take vitals
                        </Link>
                      ) : null}
                      {clinician && !e.encounter_id ? (
                        <ActionForm
                          action={startVisit}
                          aria-label={`Start visit for ${p ? personName(p) : "patient"}`}
                        >
                          <input type="hidden" name="id" value={e.id} />
                          <SubmitButton size="sm" pendingLabel="Opening...">
                            Start visit
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                      {clinical && e.encounter_id ? (
                        <Link
                          className={buttonVariants({ variant: "primary", size: "sm" })}
                          href={`/encounters/${e.encounter_id}`}
                        >
                          Open visit
                        </Link>
                      ) : null}
                      {!e.encounter_id && e.status === "waiting" ? (
                        <ConfirmAction
                          action={setQueueStatus}
                          fields={{ id: e.id, status: "with_nurse" }}
                          triggerLabel="Send to nurse"
                          title="Send to the nurse?"
                          description="The patient is marked as with the nurse for intake."
                          confirmLabel="Send to nurse"
                          variant="primary"
                        />
                      ) : null}
                      {!e.encounter_id ? (
                        <ConfirmAction
                          action={setQueueStatus}
                          fields={{ id: e.id, status: "done" }}
                          triggerLabel="Remove"
                          title="Remove from the queue?"
                          description="Use this when the patient leaves without being seen."
                          confirmLabel="Remove"
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        {done.length ? (
          <Section title="Seen today" id="done">
            <ul className="flex max-w-3xl flex-col divide-y divide-border rounded-xl border border-border bg-background">
              {done.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                  <span className="font-semibold">{e.patients ? personName(e.patients) : ""}</span>
                  <span className="text-sm text-muted">Arrived {timeOf(e.arrived_at, tz)}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </>
  );
}
