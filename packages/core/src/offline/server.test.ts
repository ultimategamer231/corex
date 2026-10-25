import { describe, expect, it } from "vitest";
import { receiveOutboxItem, SyncError } from "./server";
import { encodeItem } from "./transport";

const form = (table: string) => {
  const id = crypto.randomUUID();
  return encodeItem({ id, table, payload: { id, pulse_bpm: 80 } });
};

describe("receiveOutboxItem", () => {
  it("hands the item to its table's handler and reports the result", async () => {
    const seen: string[] = [];
    const result = await receiveOutboxItem(form("vitals"), {
      vitals: (item) => {
        seen.push(item.table);
        return Promise.resolve("exists");
      },
    });
    expect(result).toEqual({ status: "exists" });
    expect(seen).toEqual(["vitals"]);
  });

  it("refuses tables that are not offline-capable", async () => {
    expect(await receiveOutboxItem(form("clinical_notes"), {})).toEqual({
      status: "error",
      message: "This kind of record cannot be saved offline.",
    });
  });

  it("shows rule errors next to the record", async () => {
    const result = await receiveOutboxItem(form("vitals"), {
      vitals: () => Promise.reject(new SyncError("Pulse must be between 20 and 250")),
    });
    expect(result).toEqual({ status: "error", message: "Pulse must be between 20 and 250" });
  });
});
