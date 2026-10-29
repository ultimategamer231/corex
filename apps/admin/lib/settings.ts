import type { AdminDb } from "./supabase";

export const TIMEOUT_CHOICES = [60, 240, 480] as const;
export const DEVICE_DAY_CHOICES = [7, 30] as const;

export type SecuritySettings = { timeoutMinutes: number; trustedDeviceDays: number };

/** Sign-in settings from Settings → Security (AUTH-05, AUTH-06). */
export function securityFrom(config: unknown): SecuritySettings {
  const c = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const timeout = Number(c.session_timeout_minutes);
  const days = Number(c.trusted_device_days);
  return {
    timeoutMinutes: Number.isInteger(timeout) && timeout > 0 ? timeout : 240,
    trustedDeviceDays: (DEVICE_DAY_CHOICES as readonly number[]).includes(days) ? days : 30,
  };
}

export async function securitySettings(db: AdminDb): Promise<SecuritySettings> {
  const { data } = await db.from("settings").select("config").maybeSingle();
  return securityFrom(data?.config);
}
