import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders, withCorex } from "./index.mjs";

describe("securityHeaders", () => {
  const names = securityHeaders().map((h) => h.key);

  it.each([
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ])("includes %s", (name) => {
    expect(names).toContain(name);
  });

  it("forbids framing through CSP frame-ancestors", () => {
    expect(contentSecurityPolicy()).toContain("frame-ancestors 'none'");
  });

  it("only allows eval in development", () => {
    expect(contentSecurityPolicy({ dev: false })).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ dev: true })).toContain("unsafe-eval");
  });

  it("adds extra connect origins such as the Supabase URL", () => {
    expect(contentSecurityPolicy({ connectSrc: ["https://xyz.supabase.co"] })).toContain(
      "connect-src 'self' https://xyz.supabase.co",
    );
  });
});

describe("withCorex", () => {
  it("applies security headers to every route and keeps app headers", async () => {
    const config = withCorex({
      headers: async () => [{ source: "/x", headers: [{ key: "X-Test", value: "1" }] }],
    });
    const headers = (await config.headers?.()) ?? [];
    expect(headers[0]?.source).toBe("/:path*");
    expect(headers[1]?.source).toBe("/x");
    expect(config.poweredByHeader).toBe(false);
    expect(config.transpilePackages).toContain("@corex/ui");
  });
});
