import { cronRoute } from "@/lib/cron";
import { runStatusChecks } from "@/lib/status-check";
import { getServiceSupabase } from "@/lib/supabase";

/**
 * System status (audit round A3), called every 10 minutes by GitHub Actions
 * (.github/workflows/admin-status.yml) with `Authorization: Bearer <CRON_SECRET>`.
 */
const handle = cronRoute("status check", (context) => runStatusChecks(getServiceSupabase(context)));

export const GET = handle;
export const POST = handle;
