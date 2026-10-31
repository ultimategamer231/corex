"use client";

import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@corex/ui/components/sheet";
import { Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { markNotificationsSeen } from "@/app/(app)/shell-actions";
import { type AttentionItem, attentionTag } from "@/lib/dashboard";

/** The notifications bell (SPEC-ADMIN.md 11): the "Needs attention" items, unread count. */
export function Notifications({ items, unread }: { items: AttentionItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [seenFor, setSeenFor] = useState(unread);
  // A new unread count from the server (after navigating) replaces the local one.
  if (seenFor !== unread) {
    setSeenFor(unread);
    setCount(unread);
  }

  const show = () => {
    setOpen(true);
    if (count > 0) {
      setCount(0);
      void markNotificationsSeen();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? show() : setOpen(false))}>
      <Button
        variant="ghost"
        size="icon"
        onClick={show}
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        className="relative"
      >
        <Bell aria-hidden="true" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-danger-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Button>
      <SheetContent side="right" className="w-[min(26rem,92vw)] gap-3 p-0 pt-6">
        <div className="px-5">
          <SheetTitle>Needs attention</SheetTitle>
          <SheetDescription>
            {items.length === 0
              ? "Nothing needs attention today."
              : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </SheetDescription>
        </div>
        <ul className="border-t border-border-subtle">
          {items.map((item, i) => {
            const tag = attentionTag(item.kind);
            return (
              <li key={`${item.kind}-${i}`} className="border-b border-border-subtle">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 px-5 py-3 hover:bg-surface"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <Badge variant={tag.variant} className="self-start">
                      {tag.tag}
                    </Badge>
                    <span className="font-semibold text-ink">{item.title}</span>
                    <span className="text-sm text-ink-soft">{item.detail}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="px-5 pb-6">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            Open the dashboard
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
