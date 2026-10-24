import { loadSettings, type OrgSettings, type SettingsClient } from "@corex/core/settings";
import { cache } from "react";
import { getSession } from "./session";

/** The organization's settings row (CORE-01), loaded once per request. */
export const getSettings = cache(async (): Promise<OrgSettings> => {
  const { supabase } = await getSession();
  const settings = await loadSettings(supabase as unknown as SettingsClient);
  if (!settings) throw new Error("This school has no settings row; run provisioning.");
  return settings;
});

export async function letterhead() {
  const s = await getSettings();
  return {
    orgName: s.orgName,
    address: s.address,
    phone: s.phone,
    email: s.email,
    letterheadText: s.letterheadText,
  };
}
