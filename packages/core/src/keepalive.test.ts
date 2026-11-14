import { describe, expect, it, vi } from "vitest";
import { keepAlive, supabaseTouch } from "./keepalive";

describe("keepAlive", () => {
  it("touches the database and answers ok", async () => {
    const touch = vi.fn(() => Promise.resolve());
    const res = await keepAlive(() => touch)();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(touch).toHaveBeenCalledTimes(1);
  });

  it("reaches the database at most once per interval, however often it is called", async () => {
    let clock = 0;
    const touch = vi.fn(() => Promise.resolve());
    const get = keepAlive(() => touch, { intervalMs: 1000, now: () => clock });
    await Promise.all([get(), get(), get()]);
    await get();
    expect(touch).toHaveBeenCalledTimes(1);
    clock = 1000;
    await get();
    expect(touch).toHaveBeenCalledTimes(2);
  });

  it("answers 503 without details when the database cannot be reached", async () => {
    const res = await keepAlive(() => () => Promise.reject(new Error("paused: secret detail")))();
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('{"ok":false}');
  });

  it("answers 503 when the deployment has no Supabase settings", async () => {
    const res = await keepAlive(() => null)();
    expect(res.status).toBe(503);
  });
});

describe("supabaseTouch", () => {
  it("needs the URL, the service-role key and a schema", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "k",
    };
    expect(supabaseTouch({}, { schema: "corex_web", table: "leads" })).toBeNull();
    expect(supabaseTouch(env, { schema: undefined, table: "settings" })).toBeNull();
    expect(supabaseTouch(env, { schema: "corex_web", table: "leads" })).toBeTypeOf("function");
  });
});
