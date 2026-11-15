import { createClient } from "@supabase/supabase-js";

/**
 * A free Supabase project pauses after 7 days without activity. Each app's
 * `/api/keepalive` route, called once a day by a Vercel cron (the app's vercel.json),
 * reads one row so the project stays active even when GitHub's scheduled workflows do
 * not run. The route is public: it takes no input, answers only `{ ok }`, and reaches
 * the database at most once an hour per server instance, whatever the traffic.
 */
export type Touch = () => Promise<void>;

export const KEEPALIVE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Reads one row of `table` with the service role, or null when this deployment has no
 * Supabase settings (nothing to keep awake). Server only.
 */
export function supabaseTouch(
  env: Record<string, string | undefined>,
  options: { schema: string | undefined; table: string },
): Touch | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const { schema, table } = options;
  if (!url || !key || !schema) return null;
  const db = createClient(url, key, {
    db: { schema },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return async () => {
    const { error } = await db.from(table).select("*", { head: true }).limit(1);
    if (error) throw new Error(error.message);
  };
}

/** The route's GET handler: touches the database, at most once per `intervalMs`. */
export function keepAlive(
  getTouch: () => Touch | null,
  {
    intervalMs = KEEPALIVE_INTERVAL_MS,
    now = Date.now,
  }: { intervalMs?: number; now?: () => number } = {},
): () => Promise<Response> {
  let last: { at: number; ok: boolean } | undefined;
  let running: Promise<boolean> | undefined;

  async function touchOnce(): Promise<boolean> {
    const touch = getTouch();
    if (!touch) return false;
    try {
      await touch();
      return true;
    } catch {
      return false;
    }
  }

  return async function GET(): Promise<Response> {
    const at = now();
    let ok: boolean;
    if (last && at - last.at < intervalMs) {
      ok = last.ok;
    } else {
      running ??= touchOnce().finally(() => {
        running = undefined;
      });
      ok = await running;
      last = { at, ok };
    }
    return Response.json(
      { ok },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  };
}
