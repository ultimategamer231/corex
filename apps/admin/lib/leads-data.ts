import { formatMoney, isCurrency } from "@corex/core/money";
import { likePattern } from "./activity";
import { toCsv } from "./csv";
import {
  type LeadFilters,
  phoneKey,
  planLabel,
  productLabel,
  type Stage,
  STAGE_KEYS,
  stageLabel,
} from "./leads";
import type { AdminDb } from "./supabase";

export const LEAD_COLUMNS =
  "id, name, organization, country, product, plan_interest, phone, email, message, consent, source_page, source, stage, assigned_admin_id, follow_up_on, next_step, lost_reason, quote_amount_minor, quote_currency, quote_sent_on, quote_note, converted_client_id, stage_changed_at, created_at";

export type LeadRow = {
  id: string;
  name: string;
  organization: string;
  country: string | null;
  product: string | null;
  plan_interest: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  consent: boolean | null;
  source_page: string | null;
  source: string;
  stage: Stage;
  assigned_admin_id: string | null;
  follow_up_on: string | null;
  next_step: string | null;
  lost_reason: string | null;
  quote_amount_minor: number | null;
  quote_currency: string | null;
  quote_sent_on: string | null;
  quote_note: string | null;
  converted_client_id: string | null;
  stage_changed_at: string | null;
  created_at: string;
};

/** `"…"` quoting for a value inside a PostgREST or() filter. */
function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/** Leads matching the list filters except the stage, which the tabs and board split by. */
function filteredLeads(db: AdminDb, filters: LeadFilters, head = false) {
  let query = db.from("leads").select(LEAD_COLUMNS, { count: "exact", head });
  if (filters.q) {
    const pattern = quoted(likePattern(filters.q));
    const parts = ["name", "organization", "email", "phone"].map((c) => `${c}.ilike.${pattern}`);
    const key = phoneKey(filters.q);
    if (key) parts.push(`phone_key.eq.${key}`);
    query = query.or(parts.join(","));
  }
  if (filters.product) query = query.eq("product", filters.product);
  if (filters.assigned === "none") query = query.is("assigned_admin_id", null);
  else if (filters.assigned) query = query.eq("assigned_admin_id", filters.assigned);
  return query;
}

/** Newest first, filtered, one page (SPEC-ADMIN.md 6). */
export async function fetchLeads(
  db: AdminDb,
  filters: LeadFilters,
  range: { offset: number; limit: number },
  options: { allStages?: boolean } = {},
) {
  let query = filteredLeads(db, filters);
  if (filters.stage && !options.allStages) query = query.eq("stage", filters.stage);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(range.offset, range.offset + range.limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as LeadRow[], total: count ?? 0 };
}

/** How many leads match the other filters, per stage and in all (the stage tabs). */
export async function stageCounts(
  db: AdminDb,
  filters: LeadFilters,
): Promise<Record<Stage | "all", number>> {
  const keys = ["all", ...STAGE_KEYS] as const;
  const results = await Promise.all(
    keys.map(async (stage) => {
      let query = filteredLeads(db, filters, true);
      if (stage !== "all") query = query.eq("stage", stage);
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      return [stage, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<Stage | "all", number>;
}

export function quoteText(lead: Pick<LeadRow, "quote_amount_minor" | "quote_currency">): string {
  if (lead.quote_amount_minor === null || !lead.quote_currency) return "";
  if (!isCurrency(lead.quote_currency)) return "";
  return formatMoney({
    amountMinor: BigInt(lead.quote_amount_minor),
    currency: lead.quote_currency,
  });
}

/** LEAD-07: the filtered leads as CSV. */
export function leadsCsv(rows: LeadRow[], names: Map<string, string>): string {
  const header = [
    "Received (GMT)",
    "Name",
    "Organization",
    "Country",
    "Interested in",
    "Plan",
    "Phone",
    "Email",
    "Stage",
    "Assigned to",
    "Follow-up",
    "Next step",
    "Quote",
    "Quote sent",
    "Lost reason",
    "Source",
    "Message",
  ];
  return toCsv(
    header,
    rows.map((r) => [
      r.created_at,
      r.name,
      r.organization,
      r.country,
      productLabel(r.product),
      planLabel(r.plan_interest, true),
      r.phone,
      r.email,
      stageLabel(r.stage),
      r.assigned_admin_id ? (names.get(r.assigned_admin_id) ?? "Former admin") : "Unassigned",
      r.follow_up_on,
      r.next_step,
      quoteText(r),
      r.quote_sent_on,
      r.lost_reason,
      r.source === "website" ? "Website" : "Added by hand",
      r.message,
    ]),
  );
}

export type Duplicate = {
  id: string;
  name: string;
  organization: string;
  stage: string;
  matched_on: string;
};

/** LEAD-03: other leads with the same phone (any format) or email. */
export async function findDuplicates(
  db: AdminDb,
  lead: Pick<LeadRow, "id" | "phone" | "email">,
): Promise<Duplicate[]> {
  const { data, error } = await db.rpc("lead_duplicates", {
    p_phone: lead.phone ?? "",
    p_email: lead.email ?? "",
    p_exclude: lead.id,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Duplicate[];
}

export type TeamMember = { id: string; name: string; status: string };

/** Everyone for showing names; active admins for assigning. */
export async function teamMembers(db: AdminDb): Promise<TeamMember[]> {
  const { data, error } = await db.from("admins").select("id, name, status").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
