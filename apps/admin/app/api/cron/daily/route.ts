import { connection } from "next/server";
import { runDailyJob, secretMatches } from "@/lib/daily-job";
import { contextFrom } from "@/lib/request-context";
import { getServiceSupabase } from "@/lib/supabase";

/**
 * The daily job (SPEC-ADMIN.md 10), called every morning at 07:00 Monrovia time by
 * GitHub Actions (.github/workflows/admin-daily.yml) with `Authorization: Bearer
 * <CRON_SECRET>`. Without the secret it answers 401 and does nothing.
 */
async function handle(request: Request): Promise<Response> {
  await connection();
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!secretMatches(given, process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "Not allowed" }, { status: 401 });
  }
  const context = contextFrom(request.headers);
  try {
    const outcome = await runDailyJob(getServiceSupabase(context), "schedule", context);
    return Response.json({ ok: true, ...outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The daily job failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
