import { describe, expect, it } from "vitest";
import { alertText, checkOne, publicTargets, safeUrl } from "./status-check";

describe("status check addresses", () => {
  it("checks only public https sites, without their path", () => {
    expect(safeUrl("https://demo-school.corexlr.com/login")).toBe(
      "https://demo-school.corexlr.com",
    );
    expect(safeUrl("school.example.org")).toBe("https://school.example.org");
    expect(safeUrl("http://school.example.org")).toBeNull();
    expect(safeUrl("https://127.0.0.1")).toBeNull();
    expect(safeUrl("https://[::1]")).toBeNull();
    expect(safeUrl("https://localhost")).toBeNull();
    expect(safeUrl("https://db.internal")).toBeNull();
    expect(safeUrl("https://user:pass@example.org")).toBeNull();
    expect(safeUrl("https://example.org:8443")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });

  it("checks the website and the four demos by default, or the list given", () => {
    expect(publicTargets({}).map((t) => t.url)).toEqual([
      "https://www.corexlr.com",
      "https://demo-college.corexlr.com",
      "https://demo-school.corexlr.com",
      "https://demo-clinic.corexlr.com",
      "https://demo-finance.corexlr.com",
    ]);
    expect(
      publicTargets({
        STATUS_CHECK_URLS: "Website=https://www.example.org, Bad=http://x.example.org",
      }),
    ).toEqual([{ target: "Website", url: "https://www.example.org", deploymentId: null }]);
  });
});

describe("checkOne", () => {
  const target = { target: "Website", url: "https://www.example.org", deploymentId: null };
  const answer = (status: number) =>
    (() => Promise.resolve(new Response(null, { status }))) as unknown as typeof fetch;

  it("counts any answer below 500 as up, and server errors or no answer as down", async () => {
    expect((await checkOne(target, answer(200))).ok).toBe(true);
    expect((await checkOne(target, answer(302))).ok).toBe(true);
    expect((await checkOne(target, answer(404))).ok).toBe(true);
    const down = await checkOne(target, answer(503));
    expect(down).toMatchObject({ ok: false, status_code: 503 });
    const failing = (() =>
      Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
    expect(await checkOne(target, failing)).toMatchObject({
      ok: false,
      status_code: null,
      error: "Could not reach the site",
    });
  });
});

describe("alertText", () => {
  it("names what went down first, then what came back", () => {
    expect(
      alertText([
        { target: "Clinic demo", url: "https://c", ok: true, error: null },
        { target: "Website", url: "https://w", ok: false, error: "No answer within 15 seconds" },
      ]),
    ).toEqual({
      subject: "Down: Website",
      lines: [
        "Website is down (https://w). No answer within 15 seconds",
        "Clinic demo is back up (https://c).",
      ],
    });
  });
});
