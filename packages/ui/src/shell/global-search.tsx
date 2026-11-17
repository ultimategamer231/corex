"use client";

import { Button } from "../components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/dialog";
import { cn } from "../lib/utils";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export type SearchHit = {
  /** Group key, matched against `groups`. */
  kind: string;
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type GlobalSearchProps = {
  /** Server action that searches as the signed-in user (row-level security applies). */
  search: (text: string) => Promise<SearchHit[]>;
  /** Result groups in display order: `[kind, heading]`. */
  groups: readonly (readonly [string, string])[];
  /** One line on what can be found, read out with the dialog. */
  description: string;
  placeholder: string;
};

/**
 * Search from the top bar: Ctrl K or Cmd K, or the button. Results are grouped by type;
 * arrow keys move, Enter opens.
 */
export function GlobalSearch({ search, groups, description, placeholder }: GlobalSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState("");
  const [active, setActive] = useState(0);
  const latest = useRef(0);
  const id = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    const request = ++latest.current;
    const timer = setTimeout(() => {
      void search(q).then((found) => {
        if (request !== latest.current) return;
        setResults(found);
        setSearched(q);
        setActive(0);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [text, search]);

  const short = text.trim().length < 2;
  const shown = short ? [] : results;
  // Results in display order, so the arrow keys follow what is on screen.
  const ordered = groups.flatMap(([kind]) => shown.filter((r) => r.kind === kind));

  const go = (result: SearchHit | undefined) => {
    if (!result) return;
    setOpen(false);
    router.push(result.href);
  };

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setText("");
      setResults([]);
      setSearched("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        className="min-w-11 gap-2"
      >
        <Search aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Search</span>
        <kbd className="hidden rounded border border-border px-1.5 text-xs text-muted lg:inline">
          Ctrl K
        </kbd>
      </Button>
      <DialogContent className="top-[10vh] translate-y-0 gap-3 sm:max-w-xl">
        <DialogTitle>Search</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <input
          type="search"
          role="combobox"
          aria-expanded={ordered.length > 0}
          aria-controls={`${id}-results`}
          aria-activedescendant={ordered[active] ? `${id}-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Search"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(ordered.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(ordered[active]);
            }
          }}
          className="min-h-11 w-full rounded-lg border border-border-strong bg-background px-3 text-[15px] text-ink placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <div
          id={`${id}-results`}
          role="listbox"
          aria-label="Search results"
          className="max-h-[50vh] overflow-y-auto"
        >
          {groups.map(([kind, label]) => {
            const group = ordered
              .map((r, index) => ({ r, index }))
              .filter(({ r }) => r.kind === kind);
            if (group.length === 0) return null;
            return (
              <div key={kind} role="group" aria-labelledby={`${id}-${kind}`} className="py-1">
                <p
                  id={`${id}-${kind}`}
                  role="presentation"
                  className="px-2 py-1 text-xs font-bold tracking-wide text-muted uppercase"
                >
                  {label}
                </p>
                {group.map(({ r, index }) => (
                  <div
                    key={`${r.kind}-${r.id}`}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    tabIndex={-1}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") go(r);
                    }}
                    className={cn(
                      "flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-2 py-1.5",
                      index === active ? "bg-tint" : "hover:bg-surface",
                    )}
                  >
                    <span className="font-semibold text-ink">{r.title}</span>
                    <span className="text-sm text-ink-soft">{r.detail}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <p role="status" className="text-sm text-ink-soft">
          {short
            ? "Type at least 2 letters or digits."
            : searched === text.trim() && ordered.length === 0
              ? `Nothing found for "${text.trim()}".`
              : searched === text.trim()
                ? `${ordered.length} result${ordered.length === 1 ? "" : "s"}.`
                : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
