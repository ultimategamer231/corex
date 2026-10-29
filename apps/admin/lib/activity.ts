import { z } from "zod";
import { toCsv } from "./csv";
import type { AdminDb } from "./supabase";

export const AREAS = [
  ["sign_in", "Sign-ins"],
  ["team", "Team"],
  ["leads", "Leads"],
  ["clients", "Clients"],
  ["invoices", "Invoices"],
  ["payments", "Payments"],
  ["subscriptions", "Subscriptions"],
  ["settings", "Settings"],
  ["system", "System"],
] as const;

export type Area = (typeof AREAS)[number][0];

export function areaLabel(area: string): string {
  return AREAS.find(([key]) => key === area)?.[1] ?? area;
}

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

/** Filters from the activity log page's query string (LOG-04). */
export const filtersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  admin: z
    .union([z.uuid(), z.literal("system")])
    .optional()
    .catch(undefined),
  area: z
    .enum(AREAS.map(([key]) => key) as [Area, ...Area[]])
    .optional()
    .catch(undefined),
  from: date,
  to: date,
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type ActivityFilters = z.infer<typeof filtersSchema>;

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ActivityFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  return filtersSchema.parse(flat);
}

/** The filters as a query string, for links that keep them (export, pages). */
export function filtersQuery(
  filters: ActivityFilters,
  overrides: Partial<ActivityFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export type ActivityRow = {
  seq: number;
  created_at: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  area: string;
  summary: string | null;
  table_name: string;
  record_id: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
};

const COLUMNS =
  "seq, created_at, actor_type, actor_id, action, area, summary, table_name, record_id, before, after, reason, ip, user_agent";

/** `%` and `_` in a search are literal characters, not wildcards. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function dayAfter(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Newest first, filtered (LOG-04). Times are GMT, which is Monrovia time. */
export async function fetchActivity(
  db: AdminDb,
  filters: ActivityFilters,
  range: { offset: number; limit: number },
) {
  let query = db.from("audit_events").select(COLUMNS, { count: "exact" });
  if (filters.q) query = query.ilike("summary", likePattern(filters.q));
  if (filters.admin === "system") query = query.neq("actor_type", "admin");
  else if (filters.admin) query = query.eq("actor_id", filters.admin);
  if (filters.area) query = query.eq("area", filters.area);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  if (filters.to) query = query.lt("created_at", `${dayAfter(filters.to)}T00:00:00Z`);
  const { data, count, error } = await query
    .order("seq", { ascending: false })
    .range(range.offset, range.offset + range.limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as ActivityRow[], total: count ?? 0 };
}

type Json = Record<string, unknown>;

function show(value: unknown): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** What changed in a row, as "field: before → after" lines (the spec's `changes`). */
export function changeLines(row: Pick<ActivityRow, "before" | "after" | "action">): string[] {
  const before = (row.before && typeof row.before === "object" ? row.before : null) as Json | null;
  const after = (row.after && typeof row.after === "object" ? row.after : null) as Json | null;
  const skip = new Set(["updated_at", "created_at", "id"]);
  if (before && after) {
    return Object.keys(after)
      .filter((k) => !skip.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => `${k}: ${show(before[k])} → ${show(after[k])}`);
  }
  const only = after ?? before;
  if (!only) return [];
  return Object.entries(only)
    .filter(([k, v]) => !skip.has(k) && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${show(v)}`);
}

export function activityCsv(rows: ActivityRow[], names: Map<string, string>): string {
  const header = [
    "Entry",
    "When (GMT)",
    "Admin",
    "Area",
    "Action",
    "What happened",
    "Record type",
    "Record",
    "Changes",
    "IP address",
    "Browser",
  ];
  return toCsv(
    header,
    rows.map((r) => [
      r.seq,
      r.created_at,
      r.actor_id ? (names.get(r.actor_id) ?? r.actor_id) : actorLabel(r.actor_type),
      areaLabel(r.area),
      r.action,
      r.summary,
      r.table_name,
      r.record_id,
      changeLines(r).join("; "),
      r.ip,
      r.user_agent,
    ]),
  );
}

export function actorLabel(actorType: string): string {
  return actorType === "website"
    ? "Website"
    : actorType === "client_link"
      ? "Client link"
      : "System";
}
