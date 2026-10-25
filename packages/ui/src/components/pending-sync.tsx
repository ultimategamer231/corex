"use client";

import { useState } from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";

export type PendingRecord = {
  id: string;
  title: string;
  detail?: string;
  /** Why the last sync attempt failed, if it did. */
  error?: string | null;
};

/**
 * Records saved on this device that have not reached the server yet (SPEC.md 10.2).
 * Each shows "Pending sync" or its sync error, with retry and discard.
 */
export function PendingSync({
  label,
  records,
  onRetry,
  onDiscard,
}: {
  label: string;
  records: PendingRecord[];
  onRetry: () => void;
  onDiscard: (id: string) => void;
}) {
  if (records.length === 0) return null;
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-subtle/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{label}</h2>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Sync now
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-semibold">
                {r.title}{" "}
                <Badge variant={r.error ? "danger" : "warning"}>
                  {r.error ? "Not synced" : "Pending sync"}
                </Badge>
              </p>
              {r.detail ? <p className="text-sm text-muted">{r.detail}</p> : null}
              {r.error ? (
                <p className="text-sm font-medium text-danger" role="alert">
                  {r.error}
                </p>
              ) : null}
            </div>
            <DiscardButton title={r.title} onConfirm={() => onDiscard(r.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DiscardButton({ title, onConfirm }: { title: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Discard
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 text-xl font-bold">Discard this record?</DialogTitle>
        <DialogDescription className="text-[15px] text-ink-soft">
          {title} has not reached the server. Discarding deletes it from this device for good.
        </DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
