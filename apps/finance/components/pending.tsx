"use client";

import { useOffline } from "@corex/core/offline/react";
import { PendingSync } from "@corex/ui/components/pending-sync";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Entries recorded on this device and not synced yet, shown with "Pending sync" until
 * they reach the server (SPEC.md 10.2).
 */
export function PendingEntries({ label }: { label: string }) {
  const { items, syncNow, discard } = useOffline();
  const records = items
    .filter((i) => i.table === "transactions")
    .map((i) => ({
      id: i.id,
      error: i.lastError,
      title: `${i.payload.type === "income" ? "Income" : "Expense"} of ${text(i.payload.amount)}`,
      detail: [
        text(i.payload.date),
        text(i.payload.memo),
        i.payload.receipt instanceof Blob ? "with receipt photo" : "",
      ]
        .filter(Boolean)
        .join(", "),
    }));
  return (
    <PendingSync
      label={label}
      records={records}
      onRetry={() => void syncNow()}
      onDiscard={(id) => void discard(id)}
    />
  );
}
