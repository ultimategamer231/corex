import type { AdminDb } from "./supabase";
import type { RequestContext } from "./request-context";

export type LogArea =
  | "sign_in"
  | "leads"
  | "clients"
  | "invoices"
  | "payments"
  | "subscriptions"
  | "settings"
  | "team"
  | "system";

export type LogEvent = {
  area: LogArea;
  action: string;
  summary: string;
  actorId?: string | null;
  actorType?: "admin" | "system" | "website" | "client_link";
  entityType?: string;
  entityId?: string;
  /** Never passwords, codes or tokens (LOG-05); the database refuses such keys. */
  details?: Record<string, string | number | boolean | null>;
  context?: RequestContext;
};

/**
 * Writes an event that is not a row change (SPEC-ADMIN.md 5.1): sign-ins, links created,
 * emails, exports. Uses the service role; the database chains and protects the entry.
 */
export async function logEvent(service: AdminDb, event: LogEvent): Promise<void> {
  const { error } = await service.rpc("log_event", {
    p_area: event.area,
    p_action: event.action,
    p_summary: event.summary,
    p_actor_id: event.actorId ?? undefined,
    p_actor_type: event.actorType ?? (event.actorId ? "admin" : "system"),
    p_entity_type: event.entityType,
    p_entity_id: event.entityId,
    p_details: event.details,
    p_ip: event.context?.ip ?? undefined,
    p_user_agent: event.context?.userAgent ?? undefined,
  });
  if (error) throw new Error(`Could not write to the activity log: ${error.message}`);
}
