import { describe, expect, it } from "vitest";
import {
  authEmailFor,
  parseIdentifier,
  passwordSchema,
  sessionIdOf,
  USERNAME_EMAIL_DOMAIN,
} from "./identity";
import { hashToken, randomToken } from "./tokens";
import { readDeviceCookie, signDeviceCookie } from "./trusted-device";

const SECRET = "a-test-secret-that-is-long-enough-1234";
const ids = {
  deviceId: "6f1c1c3e-2b8a-4c55-9d3e-0a1b2c3d4e5f",
  userId: "0b6a6700-6444-4064-8a2e-1b0a02ff5a12",
};

describe("sign-in names", () => {
  it("accepts an email or a username, case-insensitively", () => {
    expect(parseIdentifier(" Owner@Corex.Test ")).toEqual({
      kind: "email",
      value: "owner@corex.test",
    });
    expect(parseIdentifier("Maima")).toEqual({ kind: "username", value: "maima" });
  });

  it("refuses text that could change a database filter", () => {
    expect(parseIdentifier("a,email.eq.x@y.z")).toBeNull();
    expect(parseIdentifier("maima)or(")).toBeNull();
    expect(parseIdentifier("ab")).toBeNull();
  });

  it("gives username-only admins an address on a domain that never receives mail", () => {
    expect(authEmailFor("maima", null)).toBe(`maima@${USERNAME_EMAIL_DOMAIN}`);
    expect(authEmailFor("fatu", "fatu@corex.test")).toBe("fatu@corex.test");
  });

  it("requires passwords of at least 12 characters (SPEC-ADMIN.md 3.1)", () => {
    expect(passwordSchema.safeParse("eleven-char").success).toBe(false);
    expect(passwordSchema.safeParse("twelve-chars").success).toBe(true);
  });

  it("reads the Supabase session id from an access token", () => {
    const payload = Buffer.from(JSON.stringify({ session_id: ids.deviceId })).toString("base64url");
    expect(sessionIdOf(`h.${payload}.s`)).toBe(ids.deviceId);
    expect(sessionIdOf("not-a-jwt")).toBeNull();
  });
});

describe("one-time tokens", () => {
  it("are 32 random bytes and stored only as a SHA-256 hash", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("trusted-device cookie (AUTH-06)", () => {
  const cookie = { ...ids, token: randomToken() };

  it("round-trips when signed with the same secret", () => {
    expect(readDeviceCookie(SECRET, signDeviceCookie(SECRET, cookie))).toEqual(cookie);
  });

  it("is refused when tampered with, signed with another secret, or bound to another admin", () => {
    const value = signDeviceCookie(SECRET, cookie);
    expect(readDeviceCookie(`${SECRET}x`, value)).toBeNull();
    const otherUser = value.replace(ids.userId, "11111111-1111-4111-8111-111111111111");
    expect(readDeviceCookie(SECRET, otherUser)).toBeNull();
    expect(readDeviceCookie(SECRET, `${value}x`)).toBeNull();
    expect(readDeviceCookie(SECRET, undefined)).toBeNull();
    expect(readDeviceCookie(SECRET, "a.b.c")).toBeNull();
  });
});
