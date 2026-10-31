import { todayIso } from "./format";
import { type InvoiceStatus, invoiceStatus } from "./invoices";
import type { AdminDb } from "./supabase";

export const INVOICE_COLUMNS =
  "id, display_number, kind, status, currency, party_id, contract_id, milestone_no, renewal_for, issue_date, due_date, payment_terms_days, subtotal_minor, discount_type, discount_value, discount_minor, discount_reason, tax_rate_bp, tax_minor, total_minor, notes, sent_at, void_reason, voided_at, created_at";

export type InvoiceRow = {
  id: string;
  display_number: string | null;
  kind: string;
  status: string;
  currency: string;
  party_id: string;
  contract_id: string | null;
  milestone_no: number | null;
  renewal_for: string | null;
  issue_date: string | null;
  due_date: string | null;
  payment_terms_days: number | null;
  subtotal_minor: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_minor: number;
  discount_reason: string | null;
  tax_rate_bp: number;
  tax_minor: number;
  total_minor: number;
  notes: string | null;
  sent_at: string | null;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
};

export type InvoiceSummary = InvoiceRow & {
  clientName: string;
  paidMinor: number;
  balanceMinor: number;
  shownStatus: InvoiceStatus;
};

export const STATUS_FILTERS = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["sent", "Sent"],
  ["partially_paid", "Partly paid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["void", "Void"],
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number][0];

async function withDetails(db: AdminDb, rows: InvoiceRow[]): Promise<InvoiceSummary[]> {
  if (rows.length === 0) return [];
  const [{ data: clients }, { data: balances }] = await Promise.all([
    db
      .from("clients")
      .select("id, name")
      .in("id", [...new Set(rows.map((r) => r.party_id))]),
    db
      .from("invoice_balances")
      .select("invoice_id, paid_minor")
      .in(
        "invoice_id",
        rows.map((r) => r.id),
      ),
  ]);
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const paid = new Map((balances ?? []).map((b) => [b.invoice_id, Number(b.paid_minor ?? 0)]));
  const today = todayIso();
  return rows.map((r) => {
    const paidMinor = paid.get(r.id) ?? 0;
    return {
      ...r,
      clientName: names.get(r.party_id) ?? "Unknown client",
      paidMinor,
      balanceMinor: r.status === "void" || r.status === "draft" ? 0 : r.total_minor - paidMinor,
      shownStatus: invoiceStatus(r.status, r.due_date, today),
    };
  });
}

/** Newest first; statuses as the list shows them (overdue is derived, PAY-04). */
export async function fetchInvoices(
  db: AdminDb,
  filters: { status?: StatusFilter; clientId?: string; q?: string },
  range: { offset: number; limit: number },
) {
  const today = todayIso();
  let query = db.from("invoices").select(INVOICE_COLUMNS, { count: "exact" });
  if (filters.clientId) query = query.eq("party_id", filters.clientId);
  if (filters.q) query = query.ilike("display_number", `%${filters.q.replace(/[\\%_]/g, "")}%`);
  switch (filters.status) {
    case "draft":
    case "paid":
    case "void":
    case "partially_paid":
      query = query.eq("status", filters.status);
      break;
    case "sent":
      query = query.eq("status", "issued").gte("due_date", today);
      break;
    case "overdue":
      query = query.in("status", ["issued", "partially_paid"]).lt("due_date", today);
      break;
    default:
      break;
  }
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(range.offset, range.offset + range.limit - 1);
  if (error) throw new Error(error.message);
  return {
    rows: await withDetails(db, (data ?? []) as unknown as InvoiceRow[]),
    total: count ?? 0,
  };
}

export type CurrencyTotals = Record<string, { outstanding: number; overdue: number }>;

/** Outstanding and overdue balances per currency; USD and LRD are never added (CORE-05). */
export async function outstandingTotals(db: AdminDb, clientId?: string): Promise<CurrencyTotals> {
  let query = db
    .from("invoices")
    .select("id, currency, total_minor, due_date, status, party_id")
    .in("status", ["issued", "partially_paid"]);
  if (clientId) query = query.eq("party_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    currency: string;
    total_minor: number;
    due_date: string | null;
  }[];
  const paid = new Map<string, number>();
  if (rows.length > 0) {
    const { data: balances } = await db
      .from("invoice_balances")
      .select("invoice_id, paid_minor")
      .in(
        "invoice_id",
        rows.map((r) => r.id),
      );
    for (const b of balances ?? []) paid.set(b.invoice_id ?? "", Number(b.paid_minor ?? 0));
  }
  const today = todayIso();
  const totals: CurrencyTotals = {};
  for (const r of rows) {
    const balance = r.total_minor - (paid.get(r.id) ?? 0);
    const t = (totals[r.currency] ??= { outstanding: 0, overdue: 0 });
    t.outstanding += balance;
    if (r.due_date && r.due_date < today) t.overdue += balance;
  }
  return totals;
}

/** What each client owes, per currency, for the clients list. */
export async function clientBalances(db: AdminDb): Promise<Map<string, Record<string, number>>> {
  const { data, error } = await db
    .from("invoices")
    .select("id, currency, total_minor, party_id")
    .in("status", ["issued", "partially_paid"]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    currency: string;
    total_minor: number;
    party_id: string;
  }[];
  const paid = new Map<string, number>();
  if (rows.length > 0) {
    const { data: balances } = await db
      .from("invoice_balances")
      .select("invoice_id, paid_minor")
      .in(
        "invoice_id",
        rows.map((r) => r.id),
      );
    for (const b of balances ?? []) paid.set(b.invoice_id ?? "", Number(b.paid_minor ?? 0));
  }
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const byCurrency = out.get(r.party_id) ?? {};
    byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + r.total_minor - (paid.get(r.id) ?? 0);
    out.set(r.party_id, byCurrency);
  }
  return out;
}

export type ReceiptRow = {
  id: string;
  display_number: string | null;
  issued_at: string;
  voided_at: string | null;
  payment: {
    id: string;
    invoice_id: string;
    amount_minor: number;
    currency: string;
    method: string;
    reference: string | null;
    received_at: string;
    status: string;
    void_reason: string | null;
  };
  invoiceNumber: string | null;
  clientName: string;
};

export async function fetchReceipts(
  db: AdminDb,
  range: { offset: number; limit: number },
  invoiceId?: string,
) {
  let query = db
    .from("receipts")
    .select(
      "id, display_number, issued_at, voided_at, payments!inner (id, invoice_id, amount_minor, currency, method, reference, received_at, status, void_reason)",
      { count: "exact" },
    );
  if (invoiceId) query = query.eq("payments.invoice_id", invoiceId);
  const { data, count, error } = await query
    .order("number", { ascending: false })
    .range(range.offset, range.offset + range.limit - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as (Omit<
    ReceiptRow,
    "payment" | "invoiceNumber" | "clientName"
  > & {
    payments: ReceiptRow["payment"];
  })[];
  const invoiceIds = [...new Set(rows.map((r) => r.payments.invoice_id))];
  const { data: invoices } = invoiceIds.length
    ? await db.from("invoices").select("id, display_number, party_id").in("id", invoiceIds)
    : { data: [] };
  const clientIds = [...new Set((invoices ?? []).map((i) => i.party_id))];
  const { data: clients } = clientIds.length
    ? await db.from("clients").select("id, name").in("id", clientIds)
    : { data: [] };
  const invoiceById = new Map((invoices ?? []).map((i) => [i.id, i]));
  const clientById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  return {
    total: count ?? 0,
    rows: rows.map(({ payments, ...r }) => {
      const inv = invoiceById.get(payments.invoice_id);
      return {
        ...r,
        payment: payments,
        invoiceNumber: inv?.display_number ?? null,
        clientName: inv ? (clientById.get(inv.party_id) ?? "Unknown client") : "Unknown client",
      };
    }),
  };
}

export type InvoiceLineRow = {
  id: string;
  description: string;
  details: string | null;
  quantity: number;
  unit_amount_minor: number;
  amount_minor: number;
  position: number;
};

export async function getInvoice(db: AdminDb, id: string) {
  const { data, error } = await db
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [summary] = await withDetails(db, [data as unknown as InvoiceRow]);
  const { data: lines } = await db
    .from("invoice_lines")
    .select("id, description, details, quantity, unit_amount_minor, amount_minor, position")
    .eq("invoice_id", id)
    .order("position");
  return { invoice: summary as InvoiceSummary, lines: (lines ?? []) as InvoiceLineRow[] };
}
