import { connection } from "next/server";
import { secretMatches } from "./daily-job";
import { contextFrom, type RequestContext } from "./request-context";
import { getServiceSupabase } from "./supabase";

/** Wrong secrets per address per hour before an endpoint answers 429. */
const FAILED_PER_HOUR = 10;

/**
 * A scheduled endpoint called by GitHub Actions with `Authorization: Bearer
 * <CRON_SECRET>`. Without the secret it answers 401 and does nothing; wrong secrets are
 * counted per address and answered with 429 past the limit.
 */
export function cronRoute(
  label: string,
  run: (context: RequestContext) => Promise<Record<string, unknown>>,
) {
  return async function handle(request: Request): Promise<Response> {
    await connection();
    const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    if (!process.env.CRON_SECRET) {
      return Response.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
    }
    const context = contextFrom(request.headers);
    if (!secretMatches(given, process.env.CRON_SECRET)) {
      const { data: allowed } = await getServiceSupabase(context).rpc("hit_rate_limit", {
        p_key: `cron:${context.ip ?? "unknown"}`,
        p_limit: FAILED_PER_HOUR,
        p_window_seconds: 3600,
      });
      return allowed === false
        ? Response.json({ ok: false, error: "Too many attempts" }, { status: 429 })
        : Response.json({ ok: false, error: "Not allowed" }, { status: 401 });
    }
    try {
      return Response.json({ ok: true, ...(await run(context)) });
    } catch (error) {
      const message = error instanceof Error ? error.message : `The ${label} failed`;
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  };
}
