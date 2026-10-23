"use client";

import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { cn } from "../lib/utils";
import { useOnlineStatus } from "./use-online-status";

type OnlineStatusProps = {
  /** Number of records waiting in the offline outbox (SPEC.md 10.2). */
  pendingCount?: number;
  className?: string;
};

/** Online/offline badge with the pending-sync count. Changes are announced to screen readers. */
export function OnlineStatus({ pendingCount = 0, className }: OnlineStatusProps) {
  const online = useOnlineStatus();
  const waiting =
    pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? "change" : "changes"} waiting` : "";

  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-2", className)}>
      <span
        data-state={online ? "online" : "offline"}
        className={cn(
          "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold whitespace-nowrap",
          online ? "bg-tint text-primary-dark" : "bg-warning-subtle text-warning",
        )}
      >
        {online ? (
          <Wifi className="size-4" aria-hidden="true" />
        ) : (
          <CloudOff className="size-4" aria-hidden="true" />
        )}
        {online ? "Online" : "Offline"}
      </span>
      {waiting ? (
        <span className="text-ink-soft inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap">
          <RefreshCw className="size-4" aria-hidden="true" />
          {waiting}
        </span>
      ) : null}
    </div>
  );
}
