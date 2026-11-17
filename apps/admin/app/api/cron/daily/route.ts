import { cronRoute } from "@/lib/cron";
import { runDailyJob } from "@/lib/daily-job";
import { getServiceSupabase } from "@/lib/supabase";

/**
 * The daily job (SPEC-ADMIN.md 10), called every morning at 07:00 Monrovia time by
 * GitHub Actions (.github/workflows/admin-daily.yml) with `Authorization: Bearer
 * <CRON_SECRET>`. Without the secret it answers 401 and does nothing.
 */
const handle = cronRoute("daily job", (context) =>
  runDailyJob(getServiceSupabase(context), "schedule", context),
);

export const GET = handle;
export const POST = handle;
