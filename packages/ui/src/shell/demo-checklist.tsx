"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "../lib/utils";

export type DemoStep = {
  id: string;
  label: string;
  /** Where the step starts. */
  href: string;
  /** Regular expression (as text) for the pages that complete the step. */
  match: string;
};

const EVENT = "corex-demo-steps";

function read(key: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function useDone(key: string): string[] {
  const raw = useSyncExternalStore(
    (notify) => {
      window.addEventListener(EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => window.localStorage.getItem(key) ?? "[]",
    () => "[]",
  );
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Ticks a demo step when the visitor opens one of its pages. Renders nothing. */
export function DemoStepTracker({ storageKey, steps }: { storageKey: string; steps: DemoStep[] }) {
  const pathname = usePathname();
  useEffect(() => {
    const done = read(storageKey);
    const hit = steps.filter((s) => !done.includes(s.id) && new RegExp(s.match).test(pathname));
    if (hit.length === 0) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...done, ...hit.map((s) => s.id)]));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Private browsing can refuse storage; the checklist then simply stays unticked.
    }
  }, [pathname, steps, storageKey]);
  return null;
}

/** "Things to try in this demo": steps tick themselves as the visitor explores. */
export function DemoChecklist({
  storageKey,
  steps,
  quoteUrl,
  className,
}: {
  storageKey: string;
  steps: DemoStep[];
  quoteUrl: string;
  className?: string;
}) {
  const done = useDone(storageKey);
  const count = steps.filter((s) => done.includes(s.id)).length;
  if (steps.length === 0) return null;
  return (
    <section
      aria-labelledby="demo-steps-title"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-notice-border bg-notice-subtle p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="demo-steps-title" className="font-display text-lg font-bold text-ink">
          Things to try in this demo
        </h2>
        <p className="rounded-full bg-background px-3 py-1 text-xs font-bold text-notice">
          {count} of {steps.length} done
        </p>
      </div>
      <ul className="flex flex-col">
        {steps.map((step) => {
          const ticked = done.includes(step.id);
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className="group flex min-h-11 items-center gap-3 text-[15px] text-ink hover:text-primary"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                    ticked ? "border-primary bg-primary text-white" : "border-notice-border",
                  )}
                >
                  {ticked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className={cn(ticked && "text-muted line-through")}>{step.label}</span>
                {ticked ? <span className="sr-only">(done)</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <a
        href={quoteUrl}
        className="inline-flex min-h-11 items-center self-start rounded-lg bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover"
      >
        Get this system
      </a>
    </section>
  );
}
