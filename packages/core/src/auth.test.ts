import { describe, expect, it } from "vitest";
import { type AuthClient, AuthError, isSessionExpired, requireMember } from "./auth";

function fakeClient(
  user: { id: string; email?: string; last_sign_in_at?: string } | null,
  memberships: { role: string; status: string; display_name: string }[],
): AuthClient {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user }, error: null }) },
    from: () => ({
      select: () => ({
        eq: (_column, value) =>
          Promise.resolve({ data: user && value === user.id ? memberships : [], error: null }),
      }),
    }),
  };
}

const now = new Date("2026-10-24T12:00:00Z");
const user = { id: "u1", email: "bursar@school.example", last_sign_in_at: "2026-10-24T09:00:00Z" };

describe("requireMember", () => {
  it("returns the active roles of a signed-in member", async () => {
    const client = fakeClient(user, [
      { role: "registrar", status: "active", display_name: "Jartu" },
      { role: "bursar", status: "active", display_name: "Jartu" },
    ]);
    await expect(requireMember(client, { now })).resolves.toMatchObject({
      userId: "u1",
      roles: ["bursar", "registrar"],
      displayName: "Jartu",
    });
  });

  it("rejects a signed-out visitor with 401", async () => {
    await expect(requireMember(fakeClient(null, []))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a suspended member even with a valid session (SPEC.md 5.3)", async () => {
    const client = fakeClient(user, [{ role: "bursar", status: "suspended", display_name: "J" }]);
    await expect(requireMember(client, { now })).rejects.toMatchObject({ status: 403 });
  });

  it("checks the role on the server before a write (CORE-02)", async () => {
    const client = fakeClient(user, [{ role: "registrar", status: "active", display_name: "J" }]);
    await expect(requireMember(client, { roles: ["bursar"], now })).rejects.toThrow(AuthError);
    await expect(
      requireMember(client, { roles: ["bursar", "registrar"], now }),
    ).resolves.toBeTruthy();
  });

  it("ends sessions older than the product's limit (8h school/finance, 4h clinic)", async () => {
    const client = fakeClient(user, [{ role: "nurse", status: "active", display_name: "N" }]);
    await expect(requireMember(client, { sessionHours: 4, now })).resolves.toBeTruthy();
    await expect(requireMember(client, { sessionHours: 2, now })).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("isSessionExpired", () => {
  it("treats missing or invalid sign-in times as expired", () => {
    expect(isSessionExpired(null, 8, now)).toBe(true);
    expect(isSessionExpired("not a date", 8, now)).toBe(true);
    expect(isSessionExpired("2026-10-24T04:00:01Z", 8, now)).toBe(false);
    expect(isSessionExpired("2026-10-24T03:59:59Z", 8, now)).toBe(true);
  });
});
