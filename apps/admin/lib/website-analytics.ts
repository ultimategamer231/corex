// Website visits for the admin's Website page, read from Cloudflare Web Analytics (the
// cookie-free beacon on corexlr.com) through Cloudflare's GraphQL Analytics API.
// Server only: the API token never reaches the browser.

export const RANGES = [7, 30] as const;
export type RangeDays = (typeof RANGES)[number];

export function rangeFrom(value: string | undefined): RangeDays {
  return value === "30" ? 30 : 7;
}

export type AnalyticsConfig = { apiToken: string; accountId: string; siteTag: string };

/** The Cloudflare settings, or null while they are not all set (the page then explains setup). */
export function analyticsConfig(env: Record<string, string | undefined>): AnalyticsConfig | null {
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const siteTag = env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG?.trim();
  return apiToken && accountId && siteTag ? { apiToken, accountId, siteTag } : null;
}

export type Row = { label: string; visits: number; views: number };
export type WebsiteStats = {
  visits: number;
  views: number;
  /** One entry per day in the range, oldest first, zero-filled. */
  days: { date: string; visits: number; views: number }[];
  pages: Row[];
  referrers: Row[];
  countries: Row[];
  devices: Row[];
};

const TOP = 8;

/** Human page loads of this site in the range (Cloudflare marks bots with bot: 1). */
const FILTER =
  "{ AND: [{ datetime_geq: $start, datetime_leq: $end }, { bot: 0 }, { siteTag: $siteTag }] }";

function group(alias: string, dimension: string, orderBy: string, limit: number): string {
  const dims = dimension ? ` dimensions { value: ${dimension} }` : "";
  return `${alias}: rumPageloadEventsAdaptiveGroups(filter: ${FILTER}, limit: ${limit}${
    orderBy ? `, orderBy: [${orderBy}]` : ""
  }) { count sum { visits }${dims} }`;
}

/** One request for the totals, the daily series and the top lists. */
export const QUERY = `query WebsiteStats($accountTag: string!, $siteTag: string!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      ${group("totals", "", "", 1)}
      ${group("days", "date", "date_ASC", 100)}
      ${group("pages", "requestPath", "count_DESC", TOP)}
      ${group("referrers", "refererHost", "sum_visits_DESC", TOP)}
      ${group("countries", "countryName", "sum_visits_DESC", TOP)}
      ${group("devices", "deviceType", "sum_visits_DESC", TOP)}
    }
  }
}`;

/** First and last day (YYYY-MM-DD, UTC) of a range ending today. */
export function rangeDates(days: RangeDays, now: Date): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function queryVariables(config: AnalyticsConfig, days: RangeDays, now: Date) {
  const { start } = rangeDates(days, now);
  return {
    accountTag: config.accountId,
    siteTag: config.siteTag,
    start: `${start}T00:00:00Z`,
    end: now.toISOString(),
  };
}

type Group = { count?: number; sum?: { visits?: number }; dimensions?: { value?: string } };

function rows(groups: Group[] | undefined, label: (value: string) => string): Row[] {
  return (groups ?? []).map((g) => ({
    label: label(g.dimensions?.value ?? ""),
    visits: g.sum?.visits ?? 0,
    views: g.count ?? 0,
  }));
}

const DEVICES: Record<string, string> = { desktop: "Computer", mobile: "Phone", tablet: "Tablet" };

/** Turns the API's answer into the page's numbers. Throws with Cloudflare's message on errors. */
export function parseStats(json: unknown, days: RangeDays, now: Date): WebsiteStats {
  const body = json as {
    data?: { viewer?: { accounts?: Record<string, Group[] | undefined>[] } } | null;
    errors?: { message?: string }[] | null;
  };
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message ?? "Unknown error").join("; "));
  }
  const account = body.data?.viewer?.accounts?.[0];
  if (!account) throw new Error("Cloudflare returned no data for this account.");

  const byDay = new Map(
    (account.days ?? []).map((g) => [
      g.dimensions?.value ?? "",
      { visits: g.sum?.visits ?? 0, views: g.count ?? 0 },
    ]),
  );
  const { start } = rangeDates(days, now);
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date, ...(byDay.get(date) ?? { visits: 0, views: 0 }) };
  });
  const totals = account.totals?.[0];
  return {
    visits: totals?.sum?.visits ?? 0,
    views: totals?.count ?? 0,
    days: series,
    pages: rows(account.pages, (v) => v || "/"),
    referrers: rows(account.referrers, (v) => v || "Direct or unknown"),
    countries: rows(account.countries, (v) => v || "Unknown"),
    devices: rows(account.devices, (v) => DEVICES[v.toLowerCase()] ?? (v || "Unknown")),
  };
}

const ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

/** Visits for the range, cached for 15 minutes so the page stays fast. */
export async function fetchWebsiteStats(
  config: AnalyticsConfig,
  days: RangeDays,
  now = new Date(),
): Promise<WebsiteStats> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: queryVariables(config, days, now) }),
    next: { revalidate: 900 },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Cloudflare refused the API token. Check that it can read Account Analytics.");
  }
  if (!response.ok) throw new Error(`Cloudflare answered with status ${response.status}.`);
  return parseStats(await response.json(), days, now);
}
