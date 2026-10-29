import { csvResponse } from "@/lib/csv";
import { leadFiltersSchema } from "@/lib/leads";
import { fetchLeads, leadsCsv, teamMembers } from "@/lib/leads-data";
import { logEvent } from "@/lib/log";
import { AdminAuthError, requireAdmin } from "@/lib/session";

/** The largest export in one file. */
const MAX_ROWS = 5000;

/** LEAD-07: the leads matching the current filters as CSV; the export is logged. */
export async function GET(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response("Please sign in.", { status: 401 });
    throw error;
  }
  const filters = leadFiltersSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const [{ rows }, team] = await Promise.all([
    fetchLeads(session.supabase, filters, { offset: 0, limit: MAX_ROWS }),
    teamMembers(session.supabase),
  ]);
  const names = new Map(team.map((a) => [a.id, a.name]));
  await logEvent(session.service(), {
    area: "leads",
    action: "csv_export",
    summary: `Exported ${rows.length} ${rows.length === 1 ? "lead" : "leads"} to CSV`,
    actorId: session.admin.userId,
    entityType: "leads",
    context: session.context,
  });
  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(leadsCsv(rows, names), `corex-leads-${day}.csv`);
}
