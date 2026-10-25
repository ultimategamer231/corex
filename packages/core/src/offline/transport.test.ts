import { describe, expect, it } from "vitest";
import { decodeItem, encodeItem } from "./transport";

describe("outbox transport", () => {
  it("sends the payload as JSON and blobs as files", () => {
    const id = crypto.randomUUID();
    const photo = new File([new Uint8Array([1, 2, 3])], "receipt.png", { type: "image/png" });
    const form = encodeItem({
      id,
      table: "transactions",
      payload: { id, amount: "12.50", receipt: photo },
    });
    const item = decodeItem(form);
    expect(item).toMatchObject({ id, table: "transactions", payload: { id, amount: "12.50" } });
    expect(item.payload).not.toHaveProperty("receipt");
    expect(item.files.receipt?.name).toBe("receipt.png");
    expect(item.files.receipt?.size).toBe(3);
  });

  it("refuses an item whose record id differs from the item id", () => {
    const form = new FormData();
    form.append(
      "item",
      JSON.stringify({
        id: crypto.randomUUID(),
        table: "vitals",
        payload: { id: crypto.randomUUID() },
      }),
    );
    expect(() => decodeItem(form)).toThrow(/does not match/);
  });

  it("refuses anything that is not an item", () => {
    expect(() => decodeItem(new FormData())).toThrow(/Missing item/);
  });
});
