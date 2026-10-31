import { hashToken } from "./auth/tokens";
import { loadInvoiceDocument } from "./invoice-document-data";
import { requestContext } from "./request-context";
import { getServiceSupabase } from "./supabase";

/** Opens per visitor address per hour before the client view answers "try later" (LINK-04). */
const OPENS_PER_HOUR = 60;

export type ClientLinkResult =
  | { kind: "ok"; loaded: NonNullable<Awaited<ReturnType<typeof loadInvoiceDocument>>> }
  | { kind: "invalid" }
  | { kind: "limited" };

/**
 * The invoice behind a client view link (LINK-02, LINK-03): only a valid, unexpired
 * link to an invoice that is not void shows anything. The service role reads it, since
 * the visitor is not signed in; the database logs the first open of each day.
 */
export async function openClientLink(token: string): Promise<ClientLinkResult> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { kind: "invalid" };
  const context = await requestContext();
  const service = getServiceSupabase(context);
  const { data: allowed } = await service.rpc("hit_rate_limit", {
    p_key: `client-link:${context.ip ?? "unknown"}`,
    p_limit: OPENS_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (allowed === false) return { kind: "limited" };
  const { data: invoiceId } = await service.rpc("open_invoice_link", {
    p_token_hash: hashToken(token),
    p_ip: context.ip ?? undefined,
    p_user_agent: context.userAgent ?? undefined,
  });
  if (!invoiceId) return { kind: "invalid" };
  const loaded = await loadInvoiceDocument(service, String(invoiceId));
  return loaded ? { kind: "ok", loaded } : { kind: "invalid" };
}
