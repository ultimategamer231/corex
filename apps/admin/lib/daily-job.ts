import { billingEmail, emailInvoice } from "./invoice-email";
import type { RequestContext } from "./request-context";
import type { AdminDb } from "./supabase";

type JobResult = {
  run_id: string;
  renewals: { invoice_id: string; sent: boolean }[];
  reminders: { reminder_id: string; invoice_id: string; stage: "14d" | "3d"; queued: boolean }[];
  summary: Record<string, unknown>;
};

export type DailyJobOutcome = {
  runId: string;
  summary: Record<string, unknown>;
  emails: { sent: number; failed: number; noAddress: number };
};

export function clientEmailOn(): boolean {
  return process.env.CLIENT_EMAIL_ENABLED === "true";
}

/**
 * The daily job (SPEC-ADMIN.md 10). The database does the work in one transaction
 * (daily_job: renewal invoices, reminders, flags, the run log); this then emails what it
 * sent or queued, only when client email is on. Running it twice in a day changes
 * nothing the second time.
 */
export async function runDailyJob(
  service: AdminDb,
  trigger: "schedule" | "manual",
  context?: RequestContext,
): Promise<DailyJobOutcome> {
  const email = clientEmailOn();
  const { data, error } = await service.rpc("daily_job", { p_email: email, p_trigger: trigger });
  if (error) throw new Error(error.message);
  const result = data as unknown as JobResult;
  const emails = { sent: 0, failed: 0, noAddress: 0 };
  if (!email) return { runId: result.run_id, summary: result.summary, emails };

  const clientOf = async (invoiceId: string) => {
    const { data: row } = await service
      .from("invoices")
      .select("party_id")
      .eq("id", invoiceId)
      .maybeSingle();
    return row ? billingEmail(service, row.party_id) : null;
  };
  const count = (status: string) => {
    if (status === "sent") emails.sent += 1;
    else emails.failed += 1;
  };

  for (const r of result.renewals.filter((x) => x.sent)) {
    const to = await clientOf(r.invoice_id);
    if (!to) {
      emails.noAddress += 1;
      continue;
    }
    const sent = await emailInvoice(service, r.invoice_id, to, { context });
    if (sent.kind === "done") count(sent.status);
  }
  for (const r of result.reminders.filter((x) => x.queued)) {
    const to = await clientOf(r.invoice_id);
    let status = "failed";
    if (to) {
      const sent = await emailInvoice(service, r.invoice_id, to, { reminder: r.stage, context });
      status = sent.kind === "done" ? sent.status : "failed";
      count(status);
    } else {
      emails.noAddress += 1;
    }
    await service
      .from("renewal_reminders")
      .update({ status: status === "sent" ? "sent" : "failed", sent_to: to })
      .eq("id", r.reminder_id);
  }
  return { runId: result.run_id, summary: result.summary, emails };
}

/** Constant-time comparison of the cron secret. */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected || expected.length < 32) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
