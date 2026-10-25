// How an outbox item travels to the server (SPEC.md 10.2): one FormData per item, so
// a receipt photo stored on the device goes with its record. Shared by the browser
// (encode) and the apps' sync actions (decode).
import { z } from "zod";
import type { OutboxItem } from "./outbox";

/** The server's answer for one item. "exists" means an earlier attempt stored it (OFF-02). */
export type SyncResponse = { status: "created" | "exists" } | { status: "error"; message: string };

export type DecodedItem = {
  id: string;
  table: string;
  payload: Record<string, unknown>;
  /** Files in the payload, by field name. */
  files: Record<string, File>;
};

/** FormData for one item: the payload as JSON, Blob fields as files. */
export function encodeItem(item: Pick<OutboxItem, "id" | "table" | "payload">): FormData {
  const form = new FormData();
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item.payload)) {
    if (value instanceof Blob) {
      form.append(`file:${key}`, value, value instanceof File ? value.name : key);
    } else {
      payload[key] = value;
    }
  }
  form.append("item", JSON.stringify({ id: item.id, table: item.table, payload }));
  return form;
}

const itemSchema = z.object({
  id: z.uuid(),
  table: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()),
});

/** Reads an item sent by `encodeItem`; throws on anything else. */
export function decodeItem(form: FormData): DecodedItem {
  const raw = form.get("item");
  if (typeof raw !== "string") throw new Error("Missing item");
  const item = itemSchema.parse(JSON.parse(raw));
  if (item.payload.id !== undefined && item.payload.id !== item.id) {
    throw new Error("The record id does not match the item");
  }
  const files: Record<string, File> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("file:") && value instanceof File) files[key.slice(5)] = value;
  }
  return { ...item, payload: { ...item.payload, id: item.id }, files };
}
