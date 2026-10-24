import { buildXlsx, XLSX_TYPE } from "@corex/core/xlsx";
import { renderReportPdf } from "@corex/pdf";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { DEMO_EXPORT_ROWS, demoInstance } from "@/lib/demo";
import { todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { letterhead, pdfResponse } from "@/lib/pdf";
import { formatCell, toSheet } from "@/lib/report-format";
import { buildReport, readReportRequest } from "@/lib/report-request";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

/**
 * PDF or Excel export of a report, built from the same filters and table as the
 * screen (FIN-08). Staff cannot export (FIN-07): the route is for managers only.
 */
export async function GET(request: NextRequest) {
  const { supabase } = await requireRoles(MANAGER);
  const settings = await getSettings();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const table = await buildReport(
    supabase,
    readReportRequest(params, todayIso(settings.timezone)),
    settings.baseCurrency,
  );
  if (!table) notFound();
  if (demoInstance() && table.rows.length > DEMO_EXPORT_ROWS) {
    return new Response(
      `Demo exports are limited to ${DEMO_EXPORT_ROWS} rows. Choose a shorter period.`,
      { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  const name = `${table.slug}-${params.from ?? ""}-${params.to ?? ""}`.replace(/[^\w.-]/g, "_");
  if (params.format === "xlsx") {
    return new Response(new Uint8Array(buildXlsx(toSheet(table, settings.orgName))), {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await renderReportPdf({
    org: await letterhead(),
    timezone: settings.timezone,
    title: table.title,
    subtitle: table.subtitle,
    columns: table.columns,
    rows: table.rows.map((r) => r.map(formatCell)),
    total: table.total?.map(formatCell),
    generatedAt: new Date(),
  });
  return pdfResponse(pdf, `${name}.pdf`);
}
