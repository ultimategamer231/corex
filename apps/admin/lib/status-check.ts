import { sendEmail, simpleEmailHtml } from "./email";
import type { AdminDb } from "./supabase";

export type StatusTarget = { target: string; url: string; deploymentId: string | null };
export type StatusResult = {
  target: string;
  url: string;
  deployment_id: string | null;
  ok: boolean;
  status_code: number | null;
  response_ms: number;
  error: string | null;
};

/** Public sites checked besides client systems: the website and the demos. */
export function publicTargets(
  env: Record<string, string | undefined> = process.env,
): StatusTarget[] {
  const list = env.STATUS_CHECK_URLS?.trim();
  if (list) {
    return list
      .split(",")
      .map((entry) => entry.split("="))
      .flatMap(([label = "", url = ""]) => {
        const safe = safeUrl(url.trim());
        return label.trim() && safe
          ? [{ target: label.trim(), url: safe, deploymentId: null }]
          : [];
      });
  }
  const root = env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "corexlr.com";
  return [
    { target: "Website", url: `https://www.${root}`, deploymentId: null },
    { target: "College demo", url: `https://demo-college.${root}`, deploymentId: null },
    { target: "High School demo", url: `https://demo-school.${root}`, deploymentId: null },
    { target: "Clinic demo", url: `https://demo-clinic.${root}`, deploymentId: null },
    { target: "Finance demo", url: `https://demo-finance.${root}`, deploymentId: null },
  ];
}

/**
 * Only public https addresses are checked: no plain http, no IP addresses and no
 * local names, so an address typed on a client page cannot point the check inward.
 * Returns the address without its path, or null.
 */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  return url.origin;
}

/** Client systems that are live or in staging and have an address. */
export async function clientTargets(service: AdminDb): Promise<StatusTarget[]> {
  const { data, error } = await service
    .from("deployments")
    .select("id, app_url, environment, clients(name)")
    .in("environment", ["live", "staging"])
    .not("app_url", "is", null);
  if (error) throw new Error(error.message);
  return data.flatMap((d) => {
    const url = safeUrl(d.app_url);
    if (!url) return [];
    const name = d.clients?.name ?? "Client";
    return [
      {
        target: d.environment === "staging" ? `${name} (staging)` : name,
        url,
        deploymentId: d.id,
      },
    ];
  });
}

/** Up means the site answered without a server error within 15 seconds. */
export async function checkOne(
  t: StatusTarget,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15_000,
): Promise<StatusResult> {
  const started = Date.now();
  const base = { target: t.target, url: t.url, deployment_id: t.deploymentId };
  try {
    const response = await fetcher(t.url, {
      method: "GET",
      // A redirect counts as an answer; it is not followed, so it cannot lead the
      // check to another address.
      redirect: "manual",
      cache: "no-store",
      headers: { "User-Agent": "Corex-Status-Check" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    const ok = response.status < 500;
    return {
      ...base,
      ok,
      status_code: response.status,
      response_ms: Date.now() - started,
      error: ok ? null : `The site answered with status ${response.status}`,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ...base,
      ok: false,
      status_code: null,
      response_ms: Date.now() - started,
      error: timedOut ? "No answer within 15 seconds" : "Could not reach the site",
    };
  }
}

type Change = { target: string; url: string; ok: boolean; error: string | null };

export function alertText(changes: Change[]): { subject: string; lines: string[] } {
  const down = changes.filter((c) => !c.ok);
  const up = changes.filter((c) => c.ok);
  const subject =
    down.length > 0
      ? `Down: ${down.map((c) => c.target).join(", ")}`
      : `Back up: ${up.map((c) => c.target).join(", ")}`;
  const lines = [
    ...down.map((c) => `${c.target} is down (${c.url}). ${c.error ?? ""}`.trim()),
    ...up.map((c) => `${c.target} is back up (${c.url}).`),
  ];
  return { subject, lines };
}

/**
 * Checks every target, saves the results, and emails active admins when a site goes
 * down or comes back. Returns what was checked and what changed.
 */
export async function runStatusChecks(service: AdminDb, fetcher: typeof fetch = fetch) {
  const targets = [...publicTargets(), ...(await clientTargets(service))];
  const unique = [...new Map(targets.map((t) => [t.url, t])).values()];
  const results = await Promise.all(unique.map((t) => checkOne(t, fetcher)));
  const { data, error } = await service.rpc("record_status_checks", {
    p_checks: results as never,
  });
  if (error) throw new Error(error.message);
  const changes = (data ?? []) as Change[];
  if (changes.length > 0) {
    const { data: admins } = await service
      .from("admins")
      .select("email")
      .eq("status", "active")
      .not("email", "is", null);
    const { subject, lines } = alertText(changes);
    const link = process.env.NEXT_PUBLIC_ADMIN_URL
      ? { label: "Open system status", url: `${process.env.NEXT_PUBLIC_ADMIN_URL}/status` }
      : undefined;
    for (const a of admins ?? []) {
      if (!a.email) continue;
      await sendEmail(service, {
        to: a.email,
        subject: `Corex Admin: ${subject}`,
        text: lines.join("\n"),
        html: simpleEmailHtml(subject, lines, link),
        template: "status_alert",
        audience: "team",
      });
    }
  }
  return { checked: results.length, down: results.filter((r) => !r.ok).length, changes };
}
