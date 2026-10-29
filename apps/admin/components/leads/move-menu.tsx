"use client";

import { Button } from "@corex/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@corex/ui/components/dropdown-menu";
import { toast } from "@corex/ui/components/sonner";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { moveLead } from "@/app/(app)/leads/actions";
import { idleState } from "@/lib/form-state";
import { STAGES } from "@/lib/leads";

/** The board's "Move to" menu. Lost opens the lead, where a reason is required. */
export function MoveMenu({
  leadId,
  stage,
  organization,
}: {
  leadId: string;
  stage: string;
  organization: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" disabled={pending}>
          {pending ? "Moving..." : "Move to"}
          <ChevronDown aria-hidden="true" />
          <span className="sr-only">, {organization}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-sm font-semibold text-muted">Move to</DropdownMenuLabel>
        {STAGES.filter(([key]) => key !== stage && key !== "lost").map(([key, label]) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => {
              const data = new FormData();
              data.set("leadId", leadId);
              data.set("stage", key);
              startTransition(async () => {
                const result = await moveLead(idleState, data);
                if (result.status === "success") toast.success(result.message ?? "Moved.");
                else toast.error(result.message ?? "Could not move this lead.");
              });
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
        {stage !== "lost" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/leads/${leadId}#status`}>Lost (give a reason)</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
