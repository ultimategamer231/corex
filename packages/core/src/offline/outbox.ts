// Offline outbox (SPEC.md 10): records created offline wait here until they reach
// the server. Only new records go through the outbox; edits always need a connection.
import Dexie, { type EntityTable } from "dexie";

export type OutboxStatus = "pending" | "failed";

export type OutboxItem = {
  /** Client-generated UUID, also the record's primary key on the server (CORE-06). */
  id: string;
  table: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: OutboxStatus;
};

/** Server answer for one item: stored now, or stored by an earlier attempt. */
export type SendResult = "created" | "exists";
export type Sender = (item: OutboxItem) => Promise<SendResult>;

class OutboxDatabase extends Dexie {
  outbox!: EntityTable<OutboxItem, "id">;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ outbox: "id, status, createdAt" });
  }
}

/** One database per signed-in user, so users on a shared device never see each other's items. */
export function outboxName(app: string, userId: string): string {
  return `corex-${app}-${userId}`;
}

export class Outbox {
  private readonly db: OutboxDatabase;
  private syncing: Promise<SyncSummary> | null = null;

  constructor(readonly name: string) {
    this.db = new OutboxDatabase(name);
  }

  /** Saves a new record for later sync and returns it, so the UI can show it as "Pending sync". */
  async enqueue(
    table: string,
    payload: Record<string, unknown>,
    id: string = crypto.randomUUID(),
  ): Promise<OutboxItem> {
    const item: OutboxItem = {
      id,
      table,
      payload: { ...payload, id },
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
      status: "pending",
    };
    await this.db.outbox.put(item);
    return item;
  }

  list(): Promise<OutboxItem[]> {
    return this.db.outbox.orderBy("createdAt").toArray();
  }

  /** Items not yet on the server ("N changes waiting"). */
  count(): Promise<number> {
    return this.db.outbox.count();
  }

  /**
   * Sends every item in creation order. Success or "already exists" removes it; a
   * failure keeps it with the error so the user can retry or discard. Concurrent
   * calls share one run.
   */
  sync(send: Sender): Promise<SyncSummary> {
    this.syncing ??= this.runSync(send).finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async runSync(send: Sender): Promise<SyncSummary> {
    const summary: SyncSummary = { sent: 0, failed: 0 };
    for (const item of await this.list()) {
      try {
        await send(item);
        await this.db.outbox.delete(item.id);
        summary.sent += 1;
      } catch (error) {
        await this.db.outbox.update(item.id, {
          attempts: item.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
          status: "failed",
        });
        summary.failed += 1;
      }
    }
    return summary;
  }

  /** Removes one item without sending it (the UI confirms first). */
  discard(id: string): Promise<void> {
    return this.db.outbox.delete(id);
  }

  /** Deletes the user's local database, for logout or session expiry (SPEC.md 10.2). */
  async destroy(): Promise<void> {
    this.db.close();
    await Dexie.delete(this.name);
  }
}

export type SyncSummary = { sent: number; failed: number };

/**
 * Syncs on reconnect, when the app regains focus, and every `intervalMs` while
 * online (SPEC.md 10.2). Returns a function that stops it.
 */
export function startAutoSync(
  outbox: Outbox,
  send: Sender,
  intervalMs = 60_000,
  target: Window = window,
): () => void {
  const run = () => {
    if (target.navigator.onLine) void outbox.sync(send);
  };
  const onVisible = () => {
    if (target.document.visibilityState === "visible") run();
  };
  target.addEventListener("online", run);
  target.addEventListener("focus", run);
  target.document.addEventListener("visibilitychange", onVisible);
  const timer = target.setInterval(run, intervalMs);
  run();
  return () => {
    target.removeEventListener("online", run);
    target.removeEventListener("focus", run);
    target.document.removeEventListener("visibilitychange", onVisible);
    target.clearInterval(timer);
  };
}
