import { createHmac, timingSafeEqual } from "node:crypto";

/** "Trust this device for 30 days" (SPEC-ADMIN.md 3.1, AUTH-06). */
export const TRUSTED_DEVICE_COOKIE = "corex_admin_device";

export type DeviceCookie = { deviceId: string; userId: string; token: string };

function signature(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64url");
}

/**
 * Cookie value: the device row id, the admin it belongs to and a random token, signed
 * with TRUSTED_DEVICE_SECRET. The database keeps only the token's hash.
 */
export function signDeviceCookie(secret: string, cookie: DeviceCookie): string {
  const body = `${cookie.deviceId}.${cookie.userId}.${cookie.token}`;
  return `${body}.${signature(secret, body)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The cookie's contents when its signature is valid, else null. */
export function readDeviceCookie(secret: string, value: string | undefined): DeviceCookie | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [deviceId, userId, token, sig] = parts as [string, string, string, string];
  if (!UUID.test(deviceId) || !UUID.test(userId) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const expected = Buffer.from(signature(secret, `${deviceId}.${userId}.${token}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { deviceId, userId, token };
}

export function deviceCookieOptions(secure: boolean, days: number) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: days * 24 * 60 * 60,
  };
}
