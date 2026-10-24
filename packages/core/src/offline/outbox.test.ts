import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { Outbox, outboxName, type Sender } from "./outbox";

const outboxes: Outbox[] = [];
function newOutbox() {
  const outbox = new Outbox(outboxName("test", crypto.randomUUID()));
  outboxes.push(outbox);
  return outbox;
}

afterEach(async () => {
  await Promise.all(outboxes.splice(0).map((o) => o.destroy()));
});

describe("Outbox (SPEC.md 10.2)", () => {
  it("keeps new records with a client UUID until they are sent", async () => {
    const outbox = newOutbox();
    const item = await outbox.enqueue("attendance", { status: "present" });
    expect(item.payload.id).toBe(item.id);
    expect(await outbox.count()).toBe(1);
  });

  it("removes items the server stored now or earlier (OFF-02)", async () => {
    const outbox = newOutbox();
    await outbox.enqueue("vitals", { pulse: 72 });
    await outbox.enqueue("vitals", { pulse: 80 });
    let calls = 0;
    const send: Sender = () => Promise.resolve(calls++ === 0 ? "created" : "exists");
    expect(await outbox.sync(send)).toEqual({ sent: 2, failed: 0 });
    expect(await outbox.count()).toBe(0);
  });

  it("keeps failed items with the error for retry or discard (OFF-03)", async () => {
    const outbox = newOutbox();
    const item = await outbox.enqueue("transactions", { amount_minor: 500 });
    const reject: Sender = () =>
      Promise.reject(new Error("Your access to this organization was suspended"));
    expect(await outbox.sync(reject)).toEqual({ sent: 0, failed: 1 });
    const [failed] = await outbox.list();
    expect(failed).toMatchObject({
      id: item.id,
      status: "failed",
      attempts: 1,
      lastError: /suspended/,
    });
    await outbox.discard(item.id);
    expect(await outbox.count()).toBe(0);
  });

  it("sends items in the order they were created and shares one run between callers", async () => {
    const outbox = newOutbox();
    const a = await outbox.enqueue("attendance", { n: 1 });
    const b = await outbox.enqueue("attendance", { n: 2 });
    const seen: string[] = [];
    const send: Sender = (item) => {
      seen.push(item.id);
      return Promise.resolve("created");
    };
    await Promise.all([outbox.sync(send), outbox.sync(send)]);
    expect(seen).toEqual([a.id, b.id]);
  });

  it("deletes the user's local data on logout (OFF-04)", async () => {
    const outbox = newOutbox();
    await outbox.enqueue("attendance", { n: 1 });
    await outbox.destroy();
    const reopened = new Outbox(outbox.name);
    outboxes.push(reopened);
    expect(await reopened.count()).toBe(0);
  });
});
