"use client";

// Offline capture in the apps (SPEC.md 10.2): one outbox per signed-in user, synced on
// reconnect, on focus and every minute while online, through a server action that
// re-checks the member's access for each item.
import Dexie from "dexie";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import { Outbox, type OutboxItem, outboxName } from "./outbox";
import { encodeItem, type SyncResponse } from "./transport";

/** A server action that stores one item and says whether it was new. */
export type SyncAction = (form: FormData) => Promise<SyncResponse>;

type OfflineContextValue = {
  online: boolean;
  /** Records on this device that have not reached the server yet. */
  items: OutboxItem[];
  /** Keeps a new record on this device until it syncs; returns it for display. */
  save(table: string, payload: Record<string, unknown>, id?: string): Promise<OutboxItem>;
  syncNow(): Promise<void>;
  discard(id: string): Promise<void>;
  /** Deletes this user's local data and cached pages (sign-out). */
  clear(): Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

/** The offline context, or null outside OfflineProvider (for example on the login page). */
export function useOptionalOffline(): OfflineContextValue | null {
  return use(OfflineContext);
}

export function useOffline(): OfflineContextValue {
  const value = use(OfflineContext);
  if (!value) throw new Error("useOffline must be used inside OfflineProvider");
  return value;
}

/** True while the browser reports a connection. */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function OfflineProvider({
  app,
  userId,
  send,
  onSynced,
  intervalMs = 60_000,
  children,
}: {
  app: string;
  userId: string;
  send: SyncAction;
  /** Called after records reached the server, for example to refresh the page. */
  onSynced?: () => void;
  intervalMs?: number;
  children: React.ReactNode;
}) {
  const outbox = useMemo(() => new Outbox(outboxName(app, userId)), [app, userId]);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const online = useOnline();
  const synced = useRef(onSynced);
  useEffect(() => {
    synced.current = onSynced;
  });

  const refresh = useCallback(async () => setItems(await outbox.list()), [outbox]);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return refresh();
    const summary = await outbox.sync(async (item) => {
      const result = await send(encodeItem(item));
      if (result.status === "error") throw new Error(result.message);
      return result.status;
    });
    await refresh();
    if (summary.sent > 0) synced.current?.();
  }, [outbox, send, refresh]);

  // The first run also loads the items saved on this device earlier.
  useEffect(() => {
    const run = () => void syncNow().catch(() => undefined);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("online", run);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(run, intervalMs);
    run();
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [syncNow, intervalMs]);

  const value = useMemo<OfflineContextValue>(
    () => ({
      online,
      items,
      async save(table, payload, id) {
        const item = await outbox.enqueue(table, payload, id);
        await refresh();
        void syncNow().catch(() => undefined);
        return item;
      },
      syncNow,
      async discard(id) {
        await outbox.discard(id);
        await refresh();
      },
      async clear() {
        await outbox.destroy();
        await clearCachedPages();
        setItems([]);
      },
    }),
    [online, items, outbox, refresh, syncNow],
  );

  return <OfflineContext value={value}>{children}</OfflineContext>;
}

/** Removes pages the service worker cached, so the next user of the device cannot see them. */
async function clearCachedPages(): Promise<void> {
  if (typeof caches === "undefined") return;
  for (const key of await caches.keys()) await caches.delete(key);
}

/**
 * Deletes every local outbox of this app and the cached pages, for a session that
 * ended on its own (SPEC.md 10.2: session expiry clears the device).
 */
export async function clearOfflineData(app: string): Promise<void> {
  const prefix = outboxName(app, "");
  for (const name of await Dexie.getDatabaseNames()) {
    if (name.startsWith(prefix)) await Dexie.delete(name);
  }
  await clearCachedPages();
}
