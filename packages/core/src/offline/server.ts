// Server side of offline sync (SPEC.md 10.2). The app's sync action checks the
// member's current access first (OFF-03), then hands each item to the handler for its
// table. Handlers insert with the record's own id and ignore duplicates, so sending an
// item twice stores it once (OFF-02).
import { type DecodedItem, decodeItem, type SyncResponse } from "./transport";

/** Stores one record; "exists" when an earlier attempt already stored it. */
export type ItemHandler = (item: DecodedItem) => Promise<"created" | "exists">;

/** An error whose message is shown next to the waiting record. */
export class SyncError extends Error {
  override name = "SyncError";
}

export async function receiveOutboxItem(
  form: FormData,
  handlers: Record<string, ItemHandler>,
): Promise<SyncResponse> {
  let item: DecodedItem;
  try {
    item = decodeItem(form);
  } catch {
    return {
      status: "error",
      message: "This record could not be read. Discard it and enter it again.",
    };
  }
  const handler = handlers[item.table];
  if (!handler) return { status: "error", message: "This kind of record cannot be saved offline." };
  try {
    return { status: await handler(item) };
  } catch (error) {
    if (error instanceof SyncError) return { status: "error", message: error.message };
    throw error;
  }
}
