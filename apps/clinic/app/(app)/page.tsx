import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { PageHeader } from "@corex/ui/components/page-header";
import { Stat } from "@corex/ui/components/stat";
import { CURRENCIES } from "@corex/core/money";
import Link from "next/link";
import { Section } from "@/components/section";
import { appointmentStatus, dayBounds, loadClinicians, timeOf } from "@/lib/clinic";
import { money, personName, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { monthToDate } from "@/lib/period";
import { rows, selectAll } from "@/lib/queries";
import { CLINICIAN, FRONT_DESK, REPORTS } from "@/lib/roles";
import { getSession, memberHas, type Session } from "@/lib/session";

/** Today (SPEC.md 8.4): the day's work, plus money for the Admin and Cashier. */
export default async function TodayPage() {
  const session = await getSession();
  const { member } = session;
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayIso(tz);
  const bounds = dayBounds(today, tz);
  const { supabase } = session;
  const [visits, appointments, waiting] = await Promise.all([
    supabase
      .from("encounters")
      .select("patient_id")
      .gte("opened_at", bounds.start)
      .lt("opened_at", bounds.end)
      .then(rows),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", bounds.start)
      .lt("starts_at", bounds.end)
      .neq("status", "cancelled"),
    supabase
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .neq("status", "done"),
  ]);
  const frontDesk = memberHas(member, FRONT_DESK);
  const showMoney = memberHas(member, REPORTS);

  return (
    <>
      <PageHeader title="Today" description={`Welcome, ${member.displayName}.`} />
      <div className="flex flex-col gap-10">
        {frontDesk ? (
          <div className="flex flex-wrap gap-3">
            <Link
              className={buttonVariants({ variant: "accent", size: "lg" })}
              href="/patients/new"
            >
              Register patient
            </Link>
            <Link
              className={buttonVariants({ variant: "secondary", size: "lg" })}
              href="/appointments/new"
            >
              Book appointment
            </Link>
            <Link className={buttonVariants({ variant: "secondary", size: "lg" })} href="/queue">
              Open queue
            </Link>
          </div>
        ) : null}
        <Section title="Patients" id="patients">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Patients seen today"
              value={new Set(visits.map((v) => v.patient_id)).size}
            />
            <Stat
              label="Appointments today"
              value={appointments.count ?? 0}
              detail="Not counting cancelled"
            />
            <Stat label="In the queue" value={waiting.count ?? 0} detail="Waiting or being seen" />
          </div>
        </Section>
        {showMoney ? <Money session={session} today={today} timezone={tz} /> : null}
        {frontDesk ? <TodayAppointments session={session} bounds={bounds} timezone={tz} /> : null}
      </div>
    </>
  );
}

async function Money({
  session,
  today,
  timezone,
}: {
  session: Session;
  today: string;
  timezone: string;
}) {
  const { supabase } = session;
  const month = monthToDate(today);
  const start = dayBounds(month.from, timezone).start;
  const todayStart = dayBounds(today, timezone).start;
  type Pay = { amount_minor: number; currency: string; received_at: string };
  type Open = { invoice_id: string | null; total_minor: number | null; paid_minor: number | null };
  const [payments, open] = await Promise.all([
    selectAll<Pay>(
      (a, b) =>
        supabase
          .from("payments")
          .select("amount_minor, currency, received_at")
          .eq("status", "posted")
          .gte("received_at", start)
          .range(a, b) as unknown as PromiseLike<{ data: Pay[]; error: null }>,
    ),
    selectAll<{ id: string; currency: string }>(
      (a, b) =>
        supabase
          .from("invoices")
          .select("id, currency")
          .in("status", ["issued", "partially_paid"])
          .range(a, b) as unknown as PromiseLike<{
          data: { id: string; currency: string }[];
          error: null;
        }>,
    ),
  ]);
  const ids = open.map((i) => i.id);
  const balances: Open[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    balances.push(
      ...rows(
        await supabase
          .from("invoice_balances")
          .select("invoice_id, total_minor, paid_minor")
          .in("invoice_id", ids.slice(i, i + 200)),
      ),
    );
  }
  const currencyOf = new Map(open.map((i) => [i.id, i.currency]));
  const sum = (filter: (p: Pay) => boolean, c: string) =>
    payments
      .filter((p) => p.currency === c && filter(p))
      .reduce((t, p) => t + Number(p.amount_minor), 0);
  const owed = (c: string) =>
    balances
      .filter((b) => currencyOf.get(b.invoice_id ?? "") === c)
      .reduce((t, b) => t + Number(b.total_minor ?? 0) - Number(b.paid_minor ?? 0), 0);
  return (
    <Section
      title="Money"
      id="money"
      description="Payments received, by currency."
      actions={
        <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/reports">
          Open reports
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Received today"
          value={CURRENCIES.map((c) =>
            money(
              sum((p) => p.received_at >= todayStart, c),
              c,
            ),
          ).join(" · ")}
        />
        <Stat
          label="Received this month"
          value={CURRENCIES.map((c) =>
            money(
              sum(() => true, c),
              c,
            ),
          ).join(" · ")}
        />
        <Stat
          label="Outstanding balances"
          value={CURRENCIES.map((c) => money(owed(c), c)).join(" · ")}
          detail="Issued bills not yet paid"
        />
      </div>
    </Section>
  );
}

async function TodayAppointments({
  session,
  bounds,
  timezone,
}: {
  session: Session;
  bounds: { start: string; end: string };
  timezone: string;
}) {
  const { supabase, member } = session;
  let query = supabase
    .from("appointments")
    .select("id, starts_at, clinician_id, status, patients(id, first_name, middle_name, last_name)")
    .gte("starts_at", bounds.start)
    .lt("starts_at", bounds.end)
    .neq("status", "cancelled")
    .order("starts_at")
    .limit(12);
  // Clinicians see their own day first.
  if (memberHas(member, CLINICIAN)) query = query.eq("clinician_id", member.userId);
  const [list, clinicians] = await Promise.all([query.then(rows), loadClinicians(supabase)]);
  const name = new Map(clinicians.map((c) => [c.id, c.name]));
  return (
    <Section
      title={memberHas(member, CLINICIAN) ? "Your appointments today" : "Appointments today"}
      id="appointments"
      actions={
        <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/appointments">
          Day view
        </Link>
      }
    >
      {list.length === 0 ? (
        <p className="text-muted">No appointments today.</p>
      ) : (
        <ul className="flex max-w-3xl flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {list.map((a) => {
            const s = appointmentStatus(a.status);
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
              >
                <span>
                  <span className="mr-3 font-display font-bold">
                    {timeOf(a.starts_at, timezone)}
                  </span>
                  <Link
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                    href={`/appointments/${a.id}`}
                  >
                    {a.patients ? personName(a.patients) : "Patient"}
                  </Link>
                  <span className="ml-2 text-sm text-muted">{name.get(a.clinician_id) ?? ""}</span>
                </span>
                <Badge variant={s.variant}>{s.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
