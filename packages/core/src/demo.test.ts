import { describe, expect, it } from "vitest";
import { DEMOS, demoRoleFor, reportDemoVisit } from "./demo";

describe("demo visits", () => {
  it("knows each demo account's role", () => {
    expect(demoRoleFor(DEMOS.college, "registrar@college.demo.corex.test")).toBe("registrar");
    expect(demoRoleFor(DEMOS.college, "Faculty1@college.demo.corex.test")).toBe("instructor");
    expect(demoRoleFor(DEMOS.college, "someone@example.org")).toBeNull();
  });

  it("sends only the demo and the role, and only when set up", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const fetcher = ((url: string, init: RequestInit) => {
      sent.push({ url, init });
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;
    expect(await reportDemoVisit("college", "registrar", {}, fetcher)).toBe(false);
    expect(
      await reportDemoVisit(
        "college",
        "registrar",
        { DEMO_VISITS_URL: "http://admin.example.org/api/demo-visit", DEMO_VISITS_SECRET: "s" },
        fetcher,
      ),
    ).toBe(false);
    expect(sent).toHaveLength(0);
    const env = {
      DEMO_VISITS_URL: "https://admin.example.org/api/demo-visit",
      DEMO_VISITS_SECRET: "secret",
    };
    expect(await reportDemoVisit("college", "registrar", env, fetcher)).toBe(true);
    expect(sent[0]?.init.body).toBe('{"demo":"college","role":"registrar"}');
    expect((sent[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("never fails the sign-in when the admin cannot be reached", async () => {
    const failing = (() =>
      Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
    expect(
      await reportDemoVisit(
        "clinic",
        "nurse",
        { DEMO_VISITS_URL: "https://admin.example.org/x", DEMO_VISITS_SECRET: "s" },
        failing,
      ),
    ).toBe(false);
  });
});
