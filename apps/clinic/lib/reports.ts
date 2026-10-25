// Reports (SPEC.md 8.4). Each builds one table that the screen, the PDF and the Excel
// export all render, so exports always match the screen for the same filters.
import { formatDateTime } from "@corex/core/dates";
import { CURRENCIES } from "@corex/core/money";
import { dateOf, dayBounds, METHODS, receiptNo, shiftDay } from "./clinic";
import { personName } from "./format";
import { rows, selectAll } from "./queries";
import type { ClinicDb } from "./supabase";

export type Period = { from: string; to: string };
export type MoneyCell = { minor: number; currency: string };
export type Cell = string | MoneyCell;
export type ReportTable = {
  /** File name stem for downloads. */
  slug: string;
  title: string;
  subtitle: string;
  columns: { label: string; numeric?: boolean }[];
  rows: Cell[][];
  total?: Cell[];
};

export const REPORTS = {
  cash: "Daily cash report",
  services: "Revenue by service",
  visits: "Visits by period",
} as const;
export type ReportKind = keyof typeof REPORTS;

const periodText = (p: Period) => (p.from === p.to ? p.from : `${p.from} to ${p.to}`);
const money = (minor: number, currency: string): MoneyCell => ({ minor, currency });

/** The period as instants in the organization's time zone. */
function bounds(period: Period, timezone: string) {
  return {
    start: dayBounds(period.from, timezone).start,
    end: dayBounds(shiftDay(period.to, 1), timezone).start,
  };
}

type PaymentRow = {
  id: string;
  invoice_id: string;
  amount_minor: number;
  currency: string;
  method: string;
  received_at: string;
  receipts: { number: number } | null;
};

/**
 * Money received in the period, one row per receipt, with USD and LRD in separate
 * columns. Voided payments are left out, so the totals match posted receipts (CLN-07).
 */
export async function cashReport(
  db: ClinicDb,
  period: Period,
  timezone: string,
): Promise<ReportTable> {
  const b = bounds(period, timezone);
  const payments = await selectAll<PaymentRow>(
    (from, to) =>
      db
        .from("payments")
        .select("id, invoice_id, amount_minor, currency, method, received_at, receipts(number)")
        .eq("status", "posted")
        .gte("received_at", b.start)
        .lt("received_at", b.end)
        .order("received_at")
        .range(from, to) as unknown as PromiseLike<{ data: PaymentRow[]; error: null }>,
  );
  const invoiceIds = [...new Set(payments.map((p) => p.invoice_id))];
  const invoices = invoiceIds.length
    ? await selectAll<{ id: string; number: number | null; party_id: string }>(
        (from, to) =>
          db
            .from("invoices")
            .select("id, number, party_id")
            .in("id", invoiceIds)
            .range(from, to) as unknown as PromiseLike<{
            data: { id: string; number: number | null; party_id: string }[];
            error: null;
          }>,
      )
    : [];
  const patientIds = [...new Set(invoices.map((i) => i.party_id))];
  const patients = patientIds.length
    ? rows(
        await db
          .from("patients")
          .select("id, first_name, middle_name, last_name")
          .in("id", patientIds),
      )
    : [];
  const bill = new Map(invoices.map((i) => [i.id, i]));
  const name = new Map(patients.map((p) => [p.id, personName(p)]));
  const totals: Record<string, number> = { USD: 0, LRD: 0 };
  const body: Cell[][] = payments.map((p) => {
    const inv = bill.get(p.invoice_id);
    const amount = Number(p.amount_minor);
    totals[p.currency] = (totals[p.currency] ?? 0) + amount;
    return [
      formatDateTime(p.received_at, timezone),
      p.receipts ? receiptNo(p.receipts.number) : "-",
      inv?.number ? `No. ${inv.number}` : "-",
      name.get(inv?.party_id ?? "") ?? "",
      METHODS[p.method as keyof typeof METHODS] ?? p.method,
      ...CURRENCIES.map((c) => (p.currency === c ? money(amount, c) : "")),
    ];
  });
  return {
    slug: "cash-report",
    title: REPORTS.cash,
    subtitle: `${periodText(period)}. Posted payments; voided payments are not counted.`,
    columns: [
      { label: "Received" },
      { label: "Receipt" },
      { label: "Bill" },
      { label: "Patient" },
      { label: "Method" },
      ...CURRENCIES.map((c) => ({ label: c, numeric: true })),
    ],
    rows: body,
    total: [
      "Total",
      `${payments.length} receipts`,
      "",
      "",
      "",
      ...CURRENCIES.map((c) => money(totals[c] ?? 0, c)),
    ],
  };
}

type LineRow = {
  description: string;
  quantity: number;
  amount_minor: number;
  invoices: { currency: string; status: string; issue_date: string | null } | null;
};

/** Services billed on bills issued in the period (void bills left out). */
export async function servicesReport(db: ClinicDb, period: Period): Promise<ReportTable> {
  const lines = await selectAll<LineRow>(
    (from, to) =>
      db
        .from("invoice_lines")
        .select("description, quantity, amount_minor, invoices!inner(currency, status, issue_date)")
        .gte("invoices.issue_date", period.from)
        .lte("invoices.issue_date", period.to)
        .neq("invoices.status", "void")
        .neq("invoices.status", "draft")
        .order("description")
        .range(from, to) as unknown as PromiseLike<{ data: LineRow[]; error: null }>,
  );
  const byService = new Map<string, { quantity: number; USD: number; LRD: number }>();
  for (const l of lines) {
    if (!l.invoices) continue;
    const s = byService.get(l.description) ?? { quantity: 0, USD: 0, LRD: 0 };
    s.quantity += Number(l.quantity);
    if (l.invoices.currency === "USD" || l.invoices.currency === "LRD") {
      s[l.invoices.currency] += Number(l.amount_minor);
    }
    byService.set(l.description, s);
  }
  const sorted = [...byService.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const sum = (key: "quantity" | "USD" | "LRD") => sorted.reduce((t, [, s]) => t + s[key], 0);
  return {
    slug: "revenue-by-service",
    title: REPORTS.services,
    subtitle: `${periodText(period)}. Billed on issued bills; void bills are not counted.`,
    columns: [
      { label: "Service" },
      { label: "Quantity", numeric: true },
      ...CURRENCIES.map((c) => ({ label: c, numeric: true })),
    ],
    rows: sorted.map(([service, s]) => [
      service,
      String(s.quantity),
      money(s.USD, "USD"),
      money(s.LRD, "LRD"),
    ]),
    total: ["Total", String(sum("quantity")), money(sum("USD"), "USD"), money(sum("LRD"), "LRD")],
  };
}

/** Visits opened per day in the period, with the number of different patients. */
export async function visitsReport(
  db: ClinicDb,
  period: Period,
  timezone: string,
): Promise<ReportTable> {
  const b = bounds(period, timezone);
  type Row = { patient_id: string; opened_at: string };
  const visits = await selectAll<Row>(
    (from, to) =>
      db
        .from("encounters")
        .select("patient_id, opened_at")
        .gte("opened_at", b.start)
        .lt("opened_at", b.end)
        .order("opened_at")
        .range(from, to) as unknown as PromiseLike<{ data: Row[]; error: null }>,
  );
  const days = new Map<string, { visits: number; patients: Set<string> }>();
  for (const v of visits) {
    const d = dateOf(v.opened_at, timezone);
    const day = days.get(d) ?? { visits: 0, patients: new Set<string>() };
    day.visits += 1;
    day.patients.add(v.patient_id);
    days.set(d, day);
  }
  return {
    slug: "visits",
    title: REPORTS.visits,
    subtitle: `${periodText(period)}. Days without visits are left out.`,
    columns: [
      { label: "Day" },
      { label: "Visits", numeric: true },
      { label: "Patients", numeric: true },
    ],
    rows: [...days.entries()].map(([d, s]) => [d, String(s.visits), String(s.patients.size)]),
    total: ["Total", String(visits.length), String(new Set(visits.map((v) => v.patient_id)).size)],
  };
}
