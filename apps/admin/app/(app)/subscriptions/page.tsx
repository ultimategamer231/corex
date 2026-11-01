import { Badge } from "@corex/ui/components/badge";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { cn } from "@corex/ui/lib/utils";
import { RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { contractProductLabel, money } from "@/lib/clients";
import {
  JOB_RULES,
  plural,
  reminderChips,
  renewalTiming,
  ruleOn,
  subscriptionState,
} from "@/lib/dashboard";
import { lastJobRun, subscriptionRows, warrantyRows } from "@/lib/dashboard-data";
import { formatDateTime, formatDay, todayIso } from "@/lib/format";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Subscriptions" };

const INVOICE_STATUS: Record<string, string> = {
  draft: "Draft, ready to send",
  issued: "Sent",
  partially_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
};

const CHIP_STYLE = {
  done: "bg-tint text-primary-dark",
  skipped: "bg-warning-subtle text-warning",
  failed: "bg-danger-subtle text-danger",
  todo: "bg-surface-muted text-ink-soft",
} as const;

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/** SPEC-ADMIN.md 6, 10 (Subscriptions.dc.html). */
export default async function SubscriptionsPage() {
  const { supabase } = await getAdminSession();
  const today = todayIso();
  const [rows, warranties, lastRun, settings] = await Promise.all([
    subscriptionRows(supabase),
    warrantyRows(supabase, today),
    lastJobRun(supabase),
    supabase.from("settings").select("config").maybeSingle(),
  ]);
  const config = (settings.data?.config ?? {}) as Record<string, unknown>;
  const live = rows.filter((r) => !["paused", "ended"].includes(r.state));
  const yearly = new Map<string, bigint>();
  for (const r of live) {
    yearly.set(r.currency, (yearly.get(r.currency) ?? 0n) + BigInt(r.renewal_amount_minor));
  }
  const dueSoon = live.filter((r) => r.state === "due_soon").length;
  const grace = live.filter((r) => r.state === "grace" || r.state === "pause_flag").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subscriptions and renewals"
        description="Yearly renewals for Managed clients, and warranty periods for Handover clients."
      />

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active subscriptions" value={String(live.length)} />
        <Stat
          label="Renewal value per year"
          value={
            yearly.size === 0
              ? "—"
              : [...yearly]
                  .sort(([a]) => (a === "USD" ? -1 : 1))
                  .map(([c, v]) => money(v, c))
                  .join(" · ")
          }
        />
        <Stat label="Due in next 30 days" value={String(dueSoon)} />
        <Stat label="In grace period" value={String(grace)} />
      </dl>

      <section aria-labelledby="renewals-h" className="flex flex-col gap-3">
        <h2 id="renewals-h" className="font-display text-xl font-bold text-ink">
          Managed plan renewals
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            icon={<RefreshCw aria-hidden="true" />}
            title="No subscriptions yet"
            description="A Managed client's subscription starts when their system goes live."
          />
        ) : (
          <TableScroll label="Managed plan renewals">
            <Table>
              <thead>
                <tr>
                  <Th scope="col">Client</Th>
                  <Th scope="col">Renewal date</Th>
                  <Th scope="col" className="text-right">
                    Amount
                  </Th>
                  <Th scope="col">Status</Th>
                  <Th scope="col">Reminders</Th>
                  <Th scope="col">Renewal invoice</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const state = subscriptionState(r.state);
                  const timing = renewalTiming(
                    r.days_to_renewal,
                    r.state,
                    r.pause_flag_on,
                    formatDay,
                  );
                  return (
                    <tr key={r.subscription_id}>
                      <Td>
                        <Link
                          href={`/clients/${r.client_id}`}
                          className="inline-flex min-h-11 items-center font-semibold text-ink hover:text-primary hover:underline"
                        >
                          {r.client_name}
                        </Link>
                        <span className="block text-sm text-ink-soft">
                          {contractProductLabel(r.product)}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {r.next_renewal_on ? formatDay(r.next_renewal_on) : "—"}
                        <span
                          className={cn(
                            "block text-sm",
                            r.state === "grace" || r.state === "pause_flag"
                              ? "font-semibold text-danger"
                              : r.state === "due_soon"
                                ? "font-semibold text-warning"
                                : "text-ink-soft",
                          )}
                        >
                          {timing}
                        </span>
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        {money(r.renewal_amount_minor, r.currency)}
                      </Td>
                      <Td>
                        <Badge variant={state.variant}>{state.label}</Badge>
                      </Td>
                      <Td>
                        {r.next_renewal_on ? (
                          <ul
                            aria-label={`Reminders for ${r.client_name}`}
                            className="flex flex-wrap gap-1"
                          >
                            {reminderChips(r).map((chip) => (
                              <li
                                key={chip.label}
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                                  CHIP_STYLE[chip.state],
                                )}
                              >
                                {chip.label}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {r.invoice_id ? (
                          <Link
                            href={`/invoices/${r.invoice_id}`}
                            className="inline-flex min-h-11 flex-col justify-center font-semibold text-primary hover:underline"
                          >
                            {r.invoice_number ?? "Draft"}
                            <span className="text-sm font-normal text-ink-soft">
                              {INVOICE_STATUS[r.invoice_status ?? ""] ?? r.invoice_status}
                            </span>
                          </Link>
                        ) : r.next_renewal_on && (r.days_to_renewal ?? 99) <= 30 ? (
                          <Link
                            href={`/clients/${r.client_id}`}
                            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                          >
                            Create renewal invoice
                          </Link>
                        ) : (
                          <span className="text-ink-soft">
                            {r.next_renewal_on
                              ? `Prepared ${formatDay(addDays(r.next_renewal_on, -30))}`
                              : "—"}
                          </span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </section>

      <section aria-labelledby="warranty-h" className="flex flex-col gap-3">
        <h2 id="warranty-h" className="font-display text-xl font-bold text-ink">
          Handover warranties
        </h2>
        {warranties.length === 0 ? (
          <p className="text-ink-soft">No Handover client is in a warranty period.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {warranties.map((w) => {
              const total = daysBetween(w.went_live_on, w.warranty_ends_on);
              const left = daysBetween(today, w.warranty_ends_on);
              return (
                <li
                  key={w.client_id + w.warranty_ends_on}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4"
                >
                  <Link
                    href={`/clients/${w.client_id}`}
                    className="inline-flex min-h-11 items-center font-semibold text-ink hover:text-primary hover:underline"
                  >
                    {w.client_name}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {contractProductLabel(w.product)} · went live {formatDay(w.went_live_on)}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">{plural(total, "day")} warranty</span> ·{" "}
                    <span className={left <= 45 ? "font-semibold text-warning" : "text-ink-soft"}>
                      {plural(left, "day")} left · ends {formatDay(w.warranty_ends_on)}
                    </span>
                  </p>
                  {left <= 45 ? (
                    <p className="text-sm text-ink-soft">
                      Offer a paid support plan before it ends.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="rules-h"
        className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rules-h" className="font-display text-xl font-bold text-ink">
            How renewals run
          </h2>
          <Link
            href="/settings/renewals"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
          >
            Change in Settings
          </Link>
        </div>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Rule
            when="30 days before"
            text={
              ruleOn(config, "renewal_invoice")
                ? "The renewal invoice is prepared: a draft for you to send while client email is off."
                : "Switched off: create renewal invoices by hand."
            }
          />
          <Rule
            when="14 and 3 days before"
            text={
              ruleOn(config, "reminders")
                ? "Reminders while the invoice is unpaid (emailed once client email is on)."
                : "Switched off."
            }
          />
          <Rule
            when="Renewal date passes"
            text="The client enters a 30-day grace period. Their system keeps running."
          />
          <Rule
            when="30 days overdue"
            text={
              ruleOn(config, "pause_flag")
                ? "Flagged for an admin to export the data, send it, and pause the system by hand."
                : "Switched off: no pause flag is shown."
            }
          />
        </ol>
        <p className="text-sm text-ink-soft">
          {lastRun
            ? `The daily check last ran ${formatDateTime(lastRun.started_at)}.`
            : "The daily check runs every morning at 07:00 Monrovia time. It has not run yet."}{" "}
          {JOB_RULES.filter(([rule]) => !ruleOn(config, rule)).length > 0
            ? `${plural(JOB_RULES.filter(([rule]) => !ruleOn(config, rule)).length, "rule")} switched off.`
            : null}
        </p>
      </section>
    </div>
  );
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold text-ink">{value}</dd>
    </div>
  );
}

function Rule({ when, text }: { when: string; text: string }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="font-semibold text-ink">{when}</span>
      <span className="text-sm text-ink-soft">{text}</span>
    </li>
  );
}
