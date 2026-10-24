import { createClient } from "@supabase/supabase-js";
import type { Lead } from "./schema";

/** Where quote requests go (SPEC.md 6.6); swapped by environment, not by code changes. */
export type LeadStore = {
  /** Counts one request for `key`; false once over `limit` in the window. */
  allow(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  save(lead: Lead): Promise<void>;
};

/** Development and tests: keeps leads in memory and prints them to the server log. */
export function memoryLeadStore(): LeadStore & { leads: Lead[] } {
  const hits = new Map<string, { windowStart: number; count: number }>();
  const leads: Lead[] = [];
  return {
    leads,
    allow(key, limit, windowSeconds) {
      const now = Date.now();
      const windowStart = Math.floor(now / (windowSeconds * 1000));
      const entry = hits.get(key);
      const next = entry && entry.windowStart === windowStart ? entry.count + 1 : 1;
      hits.set(key, { windowStart, count: next });
      return Promise.resolve(next <= limit);
    },
    save(lead) {
      leads.push(lead);
      // Development only: shows the lead in the terminal running `next dev`.
      // eslint-disable-next-line no-console
      console.info("[lead]", { ...lead, phone: "(hidden)", email: lead.email ? "(hidden)" : "" });
      return Promise.resolve();
    },
  };
}

/** Production: the corex_web schema of the website's Supabase project (service role, server only). */
export function supabaseLeadStore(
  url: string,
  serviceRoleKey: string,
  schema = "corex_web",
): LeadStore {
  const db = createClient(url, serviceRoleKey, {
    db: { schema },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return {
    async allow(key, limit, windowSeconds) {
      const result = await db.rpc("hit_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (result.error) throw new Error(`Rate limit check failed: ${result.error.message}`);
      const allowed: unknown = result.data;
      return allowed === true;
    },
    async save(lead) {
      const { error } = await db.from("leads").insert({
        name: lead.name,
        organization: lead.organization,
        country: lead.country,
        product: lead.product,
        plan_interest: lead.plan,
        phone: lead.phone,
        email: lead.email || null,
        message: lead.message,
        consent: lead.consent,
        source_page: lead.sourcePage,
      });
      if (error) throw new Error(`Could not store lead: ${error.message}`);
    },
  };
}

let memory: ReturnType<typeof memoryLeadStore> | undefined;

/**
 * The configured store. LEAD_STORE=memory (or no Supabase settings outside
 * production) uses memory; production without settings refuses instead of losing leads.
 */
export function leadStoreFromEnv(env: Record<string, string | undefined> = process.env): LeadStore {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.LEAD_STORE !== "memory" && url && key)
    return supabaseLeadStore(url, key, env.LEADS_SCHEMA || "corex_web");
  if (env.LEAD_STORE === "memory" || env.NODE_ENV !== "production")
    return (memory ??= memoryLeadStore());
  throw new Error(
    "Lead storage is not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).",
  );
}
