import type { AdminDb } from "../supabase";

const WINDOW_SECONDS = 15 * 60;

/** AUTH-04: failed passwords per sign-in name and per address, per 15 minutes. */
export const SIGN_IN_LIMITS = { perIdentifier: 5, perIp: 20 } as const;
/** Wrong authenticator codes per admin per 15 minutes before they must start again. */
export const CODE_LIMIT = 5;

export function signInKeys(identifier: string, ip: string | null) {
  return {
    identifier: `admin_signin:id:${identifier.trim().toLowerCase()}`,
    ip: `admin_signin:ip:${ip ?? "unknown"}`,
  };
}

export function codeKey(userId: string) {
  return `admin_code:user:${userId}`;
}

async function hits(service: AdminDb, key: string): Promise<number> {
  const { data, error } = await service.rpc("rate_limit_hits", {
    p_key: key,
    p_window_seconds: WINDOW_SECONDS,
  });
  if (error) throw new Error(`Could not check sign-in limits: ${error.message}`);
  return Number(data ?? 0);
}

/** Counts one failure under `key`. */
export async function recordFailure(service: AdminDb, key: string): Promise<void> {
  await service.rpc("hit_rate_limit", {
    p_key: key,
    p_limit: 1_000_000,
    p_window_seconds: WINDOW_SECONDS,
  });
}

export async function signInPaused(
  service: AdminDb,
  identifier: string,
  ip: string | null,
): Promise<boolean> {
  const keys = signInKeys(identifier, ip);
  const [byIdentifier, byIp] = await Promise.all([
    hits(service, keys.identifier),
    hits(service, keys.ip),
  ]);
  return byIdentifier >= SIGN_IN_LIMITS.perIdentifier || byIp >= SIGN_IN_LIMITS.perIp;
}

export async function codesPaused(service: AdminDb, userId: string): Promise<boolean> {
  return (await hits(service, codeKey(userId))) >= CODE_LIMIT;
}
