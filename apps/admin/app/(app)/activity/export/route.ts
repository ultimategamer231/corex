import { activityCsv, fetchActivity, filtersSchema } from "@/lib/activity";
import { csvResponse } from "@/lib/csv";
import { logEvent } from "@/lib/log";
import { AdminAuthError, requireAdmin } from "@/lib/session";

/** The largest export in one file. */
const MAX_ROWS = 5000;

/** LOG-04: the filtered activity log as CSV; the export itself is logged (SPEC-ADMIN.md 11). */
export async function GET(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response("Please sign in.", { status: 401 });
    throw error;
  }
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = filtersSchema.parse(params);
  const [{ rows }, { data: admins }] = await Promise.all([
    fetchActivity(session.supabase, filters, { offset: 0, limit: MAX_ROWS }),
    session.supabase.from("admins").select("user_id, name"),
  ]);
  const names = new Map((admins ?? []).map((a) => [a.user_id, a.name]));
  await logEvent(session.service(), {
    area: "system",
    action: "csv_export",
    summary: `Exported ${rows.length} activity log entries to CSV`,
    actorId: session.admin.userId,
    entityType: "audit_events",
    context: session.context,
  });
  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(activityCsv(rows, names), `corex-activity-log-${day}.csv`);
}
