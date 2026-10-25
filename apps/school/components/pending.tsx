"use client";

import { useOffline } from "@corex/core/offline/react";
import { PendingSync } from "@corex/ui/components/pending-sync";

const TITLES: Record<string, string> = {
  attendance: "Class register",
  assessment_scores: "Scores",
  period_scores: "Scores",
};

/**
 * Registers and score sheets saved on this device and not synced yet, shown with
 * "Pending sync" until they reach the server (SPEC.md 10.2).
 */
export function PendingSheets({
  table,
  label,
}: {
  table: "attendance" | "assessment_scores" | "period_scores";
  label: string;
}) {
  const { items, syncNow, discard } = useOffline();
  const records = items
    .filter((i) => i.table === table)
    .map((i) => {
      const cells = Object.keys(i.payload).filter((k) =>
        table === "attendance" ? k.startsWith("status_") : k.startsWith("score_") && i.payload[k],
      ).length;
      const date = typeof i.payload.date === "string" ? `${i.payload.date}, ` : "";
      return {
        id: i.id,
        error: i.lastError,
        title: TITLES[table] ?? "Record",
        detail: `${date}${cells} ${table === "attendance" ? "students" : "scores"}`,
      };
    });
  return (
    <PendingSync
      label={label}
      records={records}
      onRetry={() => void syncNow()}
      onDiscard={(id) => void discard(id)}
    />
  );
}
