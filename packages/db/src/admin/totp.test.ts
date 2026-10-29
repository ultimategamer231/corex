import { describe, expect, it } from "vitest";
import { totpCode } from "./totp.ts";

describe("totpCode", () => {
  // RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (base32 below), 6 digits.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("matches the RFC test vector at %i seconds", (seconds, code) => {
    expect(totpCode(secret, new Date(seconds * 1000))).toBe(code);
  });
});
