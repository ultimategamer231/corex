"use client";

import { cn } from "@corex/ui/lib/utils";
import { useState } from "react";
import { WorkCard } from "@/components/cards";
import type { WorkMeta } from "@/lib/work";

const filters = [
  { value: "all", label: "All projects" },
  { value: "client", label: "Client projects" },
  { value: "concept", label: "Concept projects" },
] as const;

export function WorkList({ items }: { items: WorkMeta[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const shown = items.filter((w) => filter === "all" || w.type === filter);
  return (
    <div className="flex flex-col gap-8">
      <div role="group" aria-label="Filter projects" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "min-h-11 rounded-full border-[1.5px] px-4 text-[15px] font-semibold",
              filter === f.value
                ? "border-primary bg-primary text-white"
                : "border-border-strong bg-background text-ink hover:border-primary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {shown.length > 0 ? (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((w) => (
            <li key={w.slug}>
              <WorkCard work={w} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No projects in this category yet.</p>
      )}
    </div>
  );
}
