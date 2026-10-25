import { monthToDate, periodFrom } from "./period";
import {
  cashReport,
  type Period,
  REPORTS,
  type ReportKind,
  type ReportTable,
  servicesReport,
  visitsReport,
} from "./reports";
import type { ClinicDb } from "./supabase";

export type ReportParams = { report?: string; from?: string; to?: string };

export type ReportRequest = { kind: ReportKind; period: Period };

/** The report and period asked for; the cash report defaults to today. */
export function readReportRequest(params: ReportParams, today: string): ReportRequest {
  const kind = (Object.keys(REPORTS) as ReportKind[]).find((k) => k === params.report) ?? "cash";
  const fallback = kind === "cash" ? { from: today, to: today } : monthToDate(today);
  return { kind, period: periodFrom(params, fallback) };
}

export function reportQuery(r: ReportRequest): URLSearchParams {
  return new URLSearchParams({ report: r.kind, from: r.period.from, to: r.period.to });
}

/** The screen and the exports both build the table here, so their numbers agree. */
export async function buildReport(
  db: ClinicDb,
  r: ReportRequest,
  timezone: string,
): Promise<ReportTable> {
  switch (r.kind) {
    case "cash":
      return cashReport(db, r.period, timezone);
    case "services":
      return servicesReport(db, r.period);
    case "visits":
      return visitsReport(db, r.period, timezone);
  }
}
