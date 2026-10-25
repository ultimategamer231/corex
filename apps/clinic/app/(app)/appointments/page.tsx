import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button, buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { appointmentStatus, dayBounds, loadClinicians, shiftDay, timeOf } from "@/lib/clinic";
import { date, personName, todayIso } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { FRONT_DESK } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";
import { cancelAppointment, checkIn, markNoShow } from "./actions";

export const metadata: Metadata = { title: "Appointments" };

type Props = { searchParams: Promise<{ date?: string; clinician?: string; booked?: string }> };

export default async function AppointmentsPage({ searchParams }: Props) {
  const { supabase, member } = await getSession();
  const frontDesk = memberHas(member, FRONT_DESK);
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayIso(tz);
  const params = await searchParams;
  const day = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const only = isUuid(params.clinician) ? params.clinician : undefined;
  const bounds = dayBounds(day, tz);

  let query = supabase
    .from("appointments")
    .select(
      "id, starts_at, duration_minutes, clinician_id, reason, status, cancel_reason, patients(id, patient_number, first_name, middle_name, last_name, has_allergies)",
    )
    .gte("starts_at", bounds.start)
    .lt("starts_at", bounds.end)
    .order("starts_at");
  if (only) query = query.eq("clinician_id", only);
  const [appointments, clinicians] = await Promise.all([
    query.then(rows),
    loadClinicians(supabase),
  ]);
  const shown = clinicians.filter((c) => !only || c.id === only);
  const known = new Set(clinicians.map((c) => c.id));
  const orphans = appointments.filter((a) => !known.has(a.clinician_id));
  const dayHref = (d: string) =>
    `/appointments?${new URLSearchParams({ date: d, ...(only ? { clinician: only } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Appointments"
        description={`${date(`${day}T12:00:00Z`, "UTC")}${day === today ? " (today)" : ""}`}
        actions={
          frontDesk ? (
            <Link
              className={buttonVariants({ variant: "accent" })}
              href={`/appointments/new?date=${day}`}
            >
              Book appointment
            </Link>
          ) : null
        }
      />
      {params.booked ? (
        <Alert tone="success" className="mb-5">
          Appointment booked.
        </Alert>
      ) : null}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <nav aria-label="Change day" className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ variant: "secondary", size: "sm" })}
            href={dayHref(shiftDay(day, -1))}
          >
            Previous day
          </Link>
          <Link
            className={buttonVariants({ variant: "secondary", size: "sm" })}
            href={dayHref(today)}
          >
            Today
          </Link>
          <Link
            className={buttonVariants({ variant: "secondary", size: "sm" })}
            href={dayHref(shiftDay(day, 1))}
          >
            Next day
          </Link>
        </nav>
        <form className="flex flex-wrap items-end gap-3" aria-label="Choose a day">
          <div className="flex w-44 flex-col gap-1.5">
            <Label htmlFor="date">Day</Label>
            <Input id="date" name="date" type="date" defaultValue={day} />
          </div>
          <div className="flex w-56 max-w-full flex-col gap-1.5">
            <Label htmlFor="clinician">Clinician</Label>
            <Select id="clinician" name="clinician" defaultValue={only ?? ""}>
              <option value="">All clinicians</option>
              {clinicians.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Show
          </Button>
        </form>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {shown.length === 0 ? <p className="text-muted">No clinicians are set up yet.</p> : null}
        {[
          ...shown.map((c) => ({ id: c.id, name: c.name })),
          ...(orphans.length && !only ? [{ id: "", name: "Former clinicians" }] : []),
        ].map((c) => {
          const list = appointments.filter((a) =>
            c.id ? a.clinician_id === c.id : !known.has(a.clinician_id),
          );
          return (
            <Section
              key={c.id || "former"}
              title={c.name}
              id={`clinician-${c.id || "former"}`}
              description={`${list.filter((a) => a.status !== "cancelled").length} booked`}
            >
              {list.length === 0 ? (
                <p className="text-muted">No appointments this day.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {list.map((a) => {
                    const s = appointmentStatus(a.status);
                    const end = new Date(Date.parse(a.starts_at) + a.duration_minutes * 60_000);
                    const p = a.patients;
                    return (
                      <li
                        key={a.id}
                        className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-display font-bold">
                            {timeOf(a.starts_at, tz)} to {timeOf(end, tz)}
                          </p>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </div>
                        {p ? (
                          <p>
                            <Link
                              className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                              href={`/patients/${p.id}`}
                            >
                              {personName(p)}
                            </Link>{" "}
                            <span className="text-sm text-muted">{p.patient_number}</span>
                            {p.has_allergies ? (
                              <Badge variant="danger" className="ml-2">
                                Allergies
                              </Badge>
                            ) : null}
                          </p>
                        ) : null}
                        {a.reason ? <p className="text-[15px] text-ink-soft">{a.reason}</p> : null}
                        {a.cancel_reason ? (
                          <p className="text-sm text-muted">Cancelled: {a.cancel_reason}</p>
                        ) : null}
                        {frontDesk && a.status === "booked" ? (
                          <div className="flex flex-wrap gap-2">
                            <ConfirmAction
                              action={checkIn}
                              fields={{ id: a.id }}
                              triggerLabel="Check in"
                              triggerVariant="primary"
                              title="Check in this patient?"
                              description="They join the queue for their clinician."
                              confirmLabel="Check in"
                              variant="primary"
                            />
                            <Link
                              className={buttonVariants({ variant: "secondary", size: "sm" })}
                              href={`/appointments/${a.id}`}
                            >
                              Reschedule
                            </Link>
                            <ConfirmAction
                              action={markNoShow}
                              fields={{ id: a.id }}
                              triggerLabel="No show"
                              title="Mark as no show?"
                              description="The appointment stays in the history."
                              confirmLabel="Mark no show"
                            />
                            <ConfirmAction
                              action={cancelAppointment}
                              fields={{ id: a.id }}
                              triggerLabel="Cancel"
                              title="Cancel this appointment?"
                              description="It stays in the patient's history with your reason."
                              confirmLabel="Cancel appointment"
                              reasonLabel="Reason"
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>
          );
        })}
      </div>
    </>
  );
}
