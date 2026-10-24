import { z } from "zod";
import { CURRENCIES } from "./money";

const settingsRow = z.object({
  org_name: z.string(),
  logo_path: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  letterhead_text: z.string().nullable(),
  base_currency: z.enum(CURRENCIES),
  enabled_currencies: z.array(z.enum(CURRENCIES)),
  timezone: z.string(),
  config: z.record(z.string(), z.unknown()),
});

export type OrgSettings = {
  orgName: string;
  logoPath: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  letterheadText: string | null;
  baseCurrency: (typeof CURRENCIES)[number];
  enabledCurrencies: (typeof CURRENCIES)[number][];
  timezone: string;
  config: Record<string, unknown>;
};

/** Converts the `settings` row; organization details are never hardcoded (CORE-01). */
export function parseSettings(row: unknown): OrgSettings {
  const s = settingsRow.parse(row);
  return {
    orgName: s.org_name,
    logoPath: s.logo_path,
    address: s.address,
    phone: s.phone,
    email: s.email,
    letterheadText: s.letterhead_text,
    baseCurrency: s.base_currency,
    enabledCurrencies: s.enabled_currencies,
    timezone: s.timezone,
    config: s.config,
  };
}

export type SettingsClient = {
  from(table: "settings"): {
    select(columns: string): {
      maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

/** Loads the organization's settings row (members only, through row-level security). */
export async function loadSettings(supabase: SettingsClient): Promise<OrgSettings | null> {
  const { data, error } = await supabase
    .from("settings")
    .select(
      "org_name, logo_path, address, phone, email, letterhead_text, base_currency, enabled_currencies, timezone, config",
    )
    .maybeSingle();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return data ? parseSettings(data) : null;
}

/** Reads a numeric product setting with a default, for example max_credits_per_term (21). */
export function configNumber(settings: OrgSettings, key: string, fallback: number): number {
  const value = settings.config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
