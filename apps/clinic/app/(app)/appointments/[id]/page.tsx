import { Badge } from "@corex/ui/components/badge";
import { PageHeader } from "@corex/ui/components/page-header";
import { formatDateTime } from "@corex/core/dates";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { SlotFields } from "@/components/slot-fields";
import { appointmentStatus, dateOf, loadClinicians, timeOf } from "@/lib/clinic";
import { personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { FRONT_DESK } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";
import { cancelAppointment, checkIn, rescheduleAppointment } from "../actions";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, member } = await getSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const tz = settings.timezone;
  const appointment = await supabase
    .from("appointments")
    .select(
      "id, starts_at, duration_minutes, clinician_id, reason, status, cancel_reason, created_at, patients(id, patient_number, first_name, middle_name, last_name)",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!appointment) notFound();
  const clinicians = await loadClinicians(supabase);
  const s = appointmentStatus(appointment.status);
  const p = appointment.patients;
  const editable = memberHas(member, FRONT_DESK) && appointment.status === "booked";
  const clinician =
    clinicians.find((c) => c.id === appointment.clinician_id)?.name ?? "Former clinician";

  return (
    <>
      <PageHeader
        title={p ? `Appointment for ${personName(p)}` : "Appointment"}
        description={`${formatDateTime(appointment.starts_at, tz)} · ${appointment.duration_minutes} minutes · ${clinician}`}
        actions={<Badge variant={s.variant}>{s.label}</Badge>}
      />
      <div className="flex max-w-3xl flex-col gap-10">
        <dl className="grid gap-3 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-muted">Patient</dt>
            <dd>
              {p ? (
                <Link
                  className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                  href={`/patients/${p.id}`}
                >
                  {personName(p)} ({p.patient_number})
                </Link>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-muted">Reason</dt>
            <dd>{appointment.reason ?? "-"}</dd>
          </div>
          {appointment.cancel_reason ? (
            <div>
              <dt className="text-sm font-semibold text-muted">Cancelled because</dt>
              <dd>{appointment.cancel_reason}</dd>
            </div>
          ) : null}
        </dl>
        {editable ? (
          <>
            <div className="flex flex-wrap gap-2">
              <ConfirmAction
                action={checkIn}
                fields={{ id }}
                triggerLabel="Check in"
                triggerVariant="accent"
                triggerSize="md"
                title="Check in this patient?"
                description="They join the queue for their clinician."
                confirmLabel="Check in"
                variant="primary"
              />
              <ConfirmAction
                action={cancelAppointment}
                fields={{ id }}
                triggerLabel="Cancel appointment"
                triggerSize="md"
                title="Cancel this appointment?"
                description="It stays in the patient's history with your reason."
                confirmLabel="Cancel appointment"
                reasonLabel="Reason"
              />
            </div>
            <Section title="Reschedule" id="reschedule">
              <ActionForm
                action={rescheduleAppointment}
                resetOnSuccess={false}
                aria-label="Reschedule"
                className="rounded-xl border border-border bg-background p-5"
              >
                <input type="hidden" name="id" value={id} />
                <SlotFields
                  clinicians={clinicians}
                  today={todayIso(tz)}
                  defaults={{
                    clinician_id: appointment.clinician_id,
                    date: dateOf(appointment.starts_at, tz),
                    time: timeOf(appointment.starts_at, tz),
                    duration_minutes: appointment.duration_minutes,
                  }}
                />
                <div>
                  <SubmitButton>Move appointment</SubmitButton>
                </div>
              </ActionForm>
            </Section>
          </>
        ) : null}
      </div>
    </>
  );
}
