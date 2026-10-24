import type { Currency } from "@corex/core/money";
import { isUuid } from "./ids";
import { lastTwelveMonths, monthToDate, periodFrom } from "./period";
import {
  categoryReport,
  payrollReport,
  type Period,
  REPORTS,
  type ReportKind,
  type ReportTable,
  statementReport,
  summaryReport,
} from "./reports";
import type { FinanceDb } from "./supabase";

export type ReportParams = { report?: string; from?: string; to?: string; account?: string };

export type ReportRequest = { kind: ReportKind; period: Period; account?: string };

/** The report, period and account asked for, with defaults for anything missing. */
export function readReportRequest(params: ReportParams, today: string): ReportRequest {
  const kind = (Object.keys(REPORTS) as ReportKind[]).find((k) => k === params.report) ?? "summary";
  const fallback =
    kind === "summary" || kind === "payroll" ? lastTwelveMonths(today) : monthToDate(today);
  return {
    kind,
    period: periodFrom(params, fallback),
    account: isUuid(params.account) ? params.account : undefined,
  };
}

export function reportQuery(r: ReportRequest): URLSearchParams {
  return new URLSearchParams({
    report: r.kind,
    from: r.period.from,
    to: r.period.to,
    ...(r.account ? { account: r.account } : {}),
  });
}

/**
 * Builds the table for a request. The page and the exports both call this with the
 * same filters, so the numbers always agree (FIN-08).
 */
export async function buildReport(
  db: FinanceDb,
  r: ReportRequest,
  base: Currency,
): Promise<ReportTable | null> {
  switch (r.kind) {
    case "summary":
      return summaryReport(db, r.period, base);
    case "categories":
      return categoryReport(db, r.period, base);
    case "payroll":
      return payrollReport(db, r.period);
    case "statement":
      return r.account ? statementReport(db, r.account, r.period) : null;
  }
}
