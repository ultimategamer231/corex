// Reads for the dashboard, subscriptions page, notifications and search. Every figure
// comes from a database function (packages/db/admin/migrations/0007_operations.sql),
// tested against fixtures there.
import { cache } from "react";
import { type AttentionItem, type Figures, figuresSchema } from "./dashboard";
import type { AdminDb } from "./supabase";

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("No data");
  return result.data;
}

export async function dashboardFigures(db: AdminDb): Promise<Figures> {
  return figuresSchema.parse(must(await db.rpc("dashboard_figures", {})));
}

/** "Needs attention", shared by the dashboard and the notifications bell in one request. */
export const attentionItems = cache(async (db: AdminDb): Promise<AttentionItem[]> => {
  const rows = must(await db.rpc("attention_items", {}));
  return rows.map((r) => ({
    kind: r.kind as AttentionItem["kind"],
    title: r.title,
    detail: r.detail,
    href: r.href,
    since: r.since,
  }));
});

export type SubscriptionRow = {
  subscription_id: string;
  client_id: string;
  client_name: string;
  product: string;
  renewal_amount_minor: number;
  currency: string;
  next_renewal_on: string | null;
  days_to_renewal: number | null;
  state: string;
  pause_flag_on: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  invoice_due_on: string | null;
  reminder_14d: string | null;
  reminder_3d: string | null;
};

export async function subscriptionRows(db: AdminDb): Promise<SubscriptionRow[]> {
  return must(await db.rpc("subscription_overview", {})) as SubscriptionRow[];
}

export type WarrantyRow = {
  client_id: string;
  client_name: string;
  product: string;
  went_live_on: string;
  warranty_ends_on: string;
};

/** Handover warranties that have not ended yet, soonest first. */
export async function warrantyRows(db: AdminDb, today: string): Promise<WarrantyRow[]> {
  const rows = must(
    await db
      .from("deployments")
      .select(
        "client_id, went_live_on, warranty_ends_on, environment, clients(name), contracts(product, plan)",
      )
      .not("warranty_ends_on", "is", null)
      .gte("warranty_ends_on", today)
      .neq("environment", "ended")
      .order("warranty_ends_on"),
  );
  return rows.map((r) => ({
    client_id: r.client_id,
    client_name: r.clients?.name ?? "",
    product: r.contracts?.product ?? "",
    went_live_on: r.went_live_on ?? "",
    warranty_ends_on: r.warranty_ends_on ?? "",
  }));
}

export type RecentEvent = { seq: number; summary: string; area: string; created_at: string };

export async function recentActivity(db: AdminDb, limit = 6): Promise<RecentEvent[]> {
  const rows = must(
    await db
      .from("audit_events")
      .select("seq, summary, area, created_at")
      .order("seq", { ascending: false })
      .limit(limit),
  );
  return rows.map((r) => ({
    seq: Number(r.seq),
    summary: r.summary ?? "",
    area: r.area ?? "system",
    created_at: r.created_at,
  }));
}

export async function notificationsSeenAt(db: AdminDb, userId: string): Promise<string | null> {
  const { data } = await db
    .from("admin_notification_state")
    .select("seen_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.seen_at ?? null;
}

export async function hasSampleData(db: AdminDb): Promise<boolean> {
  const { data } = await db.rpc("has_sample_data", {});
  return data === true;
}

export type LastRun = { started_at: string; summary: Record<string, unknown> } | null;

export async function lastJobRun(db: AdminDb): Promise<LastRun> {
  const { data } = await db
    .from("job_runs")
    .select("started_at, summary")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? { started_at: data.started_at, summary: data.summary as Record<string, unknown> }
    : null;
}
