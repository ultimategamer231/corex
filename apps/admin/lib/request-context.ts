import { headers } from "next/headers";

export type RequestContext = { ip: string | null; userAgent: string | null };

/** The visitor's address and browser, for sign-in limits and the activity log. */
export function contextFrom(h: Headers): RequestContext {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 300) || null;
  return { ip, userAgent };
}

export async function requestContext(): Promise<RequestContext> {
  return contextFrom(await headers());
}

/**
 * Request headers that let the database's activity log record who acted and from
 * where (packages/db/admin/migrations/0001_activity_log.sql). The actor header is
 * honored only for service-role calls.
 */
export function logHeaders(
  context: RequestContext,
  actorUserId?: string | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (context.ip) out["x-corex-ip"] = context.ip;
  if (context.userAgent) out["x-corex-user-agent"] = context.userAgent;
  if (actorUserId) out["x-corex-actor"] = actorUserId;
  return out;
}
