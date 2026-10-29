import { type ClientStatus, clientStatus, contractProductLabel, clientPlanLabel } from "./clients";
import { formatDay, todayIso } from "./format";
import type { AdminDb } from "./supabase";

const SUMMARY_COLUMNS = `id, name, city, country, created_at, source_lead_id,
  contracts (id, number, product, plan, total_minor, currency, signed_on, milestone_scheme),
  deployments (id, environment, target_go_live, went_live_on, warranty_ends_on, created_at),
  subscriptions (id, contract_id, renewal_amount_minor, currency, starts_on, next_renewal_on, paused_at, ended_at)`;

type ContractRow = {
  id: string;
  number: string;
  product: string;
  plan: string;
  total_minor: number;
  currency: string;
  signed_on: string;
  milestone_scheme: number[];
};
type DeploymentRow = {
  id: string;
  environment: string;
  target_go_live: string | null;
  went_live_on: string | null;
  warranty_ends_on: string | null;
  created_at: string;
};
type SubscriptionRow = {
  id: string;
  contract_id: string;
  renewal_amount_minor: number;
  currency: string;
  starts_on: string | null;
  next_renewal_on: string | null;
  paused_at: string | null;
  ended_at: string | null;
};
type ClientRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  created_at: string;
  source_lead_id: string | null;
  contracts: ContractRow[];
  deployments: DeploymentRow[];
  subscriptions: SubscriptionRow[];
};

export type ClientSummary = {
  id: string;
  name: string;
  place: string;
  product: string;
  plan: string | null;
  status: ClientStatus;
  keyDate: string;
  since: string;
  contract: ContractRow | null;
  deployment: DeploymentRow | null;
  subscription: SubscriptionRow | null;
};

const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function latest<T>(rows: T[], key: (row: T) => string): T | null {
  return rows.reduce<T | null>((best, row) => (!best || key(row) > key(best) ? row : best), null);
}

/** The newest contract and deployment decide what the list shows (one per client today). */
export function summarize(row: ClientRow, today = todayIso()): ClientSummary {
  const contract = latest(row.contracts, (c) => c.signed_on);
  const deployment = latest(row.deployments, (d) => d.created_at);
  const subscription =
    row.subscriptions.find((s) => s.contract_id === contract?.id) ?? row.subscriptions[0] ?? null;
  const status = clientStatus(
    {
      plan: contract?.plan ?? null,
      environment: deployment?.environment ?? null,
      warrantyEndsOn: deployment?.warranty_ends_on ?? null,
      nextRenewalOn: subscription?.next_renewal_on ?? null,
      subscriptionPaused: Boolean(subscription?.paused_at),
      subscriptionEnded: Boolean(subscription?.ended_at),
    },
    today,
  );
  const keyDate = (() => {
    switch (status) {
      case "setting_up":
        return deployment?.target_go_live
          ? `Go-live ${formatDay(deployment.target_go_live)}`
          : "Go-live not set";
      case "in_warranty":
        return `Warranty ends ${formatDay(deployment?.warranty_ends_on)}`;
      case "grace_period":
        return `Was due ${formatDay(subscription?.next_renewal_on)}`;
      case "renewal_due":
      case "active":
        return subscription?.next_renewal_on
          ? `Renews ${formatDay(subscription.next_renewal_on)}`
          : deployment?.went_live_on
            ? `Live since ${formatDay(deployment.went_live_on)}`
            : "—";
      default:
        return "—";
    }
  })();
  return {
    id: row.id,
    name: row.name,
    place: [row.city, row.country].filter(Boolean).join(", "),
    product: contract ? contractProductLabel(contract.product) : "No contract",
    plan: contract ? clientPlanLabel(contract.plan) : null,
    status,
    keyDate,
    since: monthYear.format(
      new Date(`${contract?.signed_on ?? row.created_at.slice(0, 10)}T00:00:00Z`),
    ),
    contract,
    deployment,
    subscription,
  };
}

/** Every client with its status; the list filters by status in memory (few clients). */
export async function clientSummaries(db: AdminDb, search?: string): Promise<ClientSummary[]> {
  let query = db.from("clients").select(SUMMARY_COLUMNS).order("name");
  if (search) query = query.ilike("name", `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ClientRow[]).map((row) => summarize(row));
}

export async function clientSummary(db: AdminDb, id: string): Promise<ClientSummary | null> {
  const { data, error } = await db
    .from("clients")
    .select(SUMMARY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? summarize(data as unknown as ClientRow) : null;
}

/** The minimum renewal against hosting (Settings → Renewals); 3 until set (SPEC-ADMIN.md 4). */
export async function hostingMultiple(db: AdminDb): Promise<number> {
  const { data } = await db.from("settings").select("config").maybeSingle();
  const value = Number(
    (data?.config as Record<string, unknown> | undefined)?.renewal_min_hosting_multiple,
  );
  return Number.isFinite(value) && value > 0 ? value : 3;
}
