"use client";

import { useOffline } from "@corex/core/offline/react";
import { PendingSync, type PendingRecord } from "@corex/ui/components/pending-sync";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function describe(table: string, payload: Record<string, unknown>): Omit<PendingRecord, "id"> {
  if (table === "patients") {
    return {
      title: [text(payload.first_name), text(payload.middle_name), text(payload.last_name)]
        .filter(Boolean)
        .join(" "),
      detail: "New patient. The patient number is given when it syncs.",
    };
  }
  const parts = [
    text(payload.temperature_c) && `${text(payload.temperature_c)} °C`,
    text(payload.bp_systolic) && `BP ${text(payload.bp_systolic)}/${text(payload.bp_diastolic)}`,
    text(payload.pulse_bpm) && `pulse ${text(payload.pulse_bpm)}`,
  ].filter(Boolean);
  return { title: "Vitals", detail: parts.join(", ") };
}

/**
 * Records of one kind saved on this device and not synced yet, shown with "Pending
 * sync" until they reach the server (SPEC.md 10.2).
 */
export function PendingRecords({
  table,
  label,
  patientId,
}: {
  table: "patients" | "vitals";
  label: string;
  /** Only this patient's records. */
  patientId?: string;
}) {
  const { items, syncNow, discard } = useOffline();
  const records = items
    .filter((i) => i.table === table && (!patientId || i.payload.patient_id === patientId))
    .map((i) => ({ id: i.id, error: i.lastError, ...describe(table, i.payload) }));
  return (
    <PendingSync
      label={label}
      records={records}
      onRetry={() => void syncNow()}
      onDiscard={(id) => void discard(id)}
    />
  );
}
