import { Construction } from "lucide-react";

/** Empty state for sections not built yet. */
export function PendingSection({ section }: { section: string }) {
  return (
    <section
      aria-label={`${section} status`}
      className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border-strong bg-background p-6 md:p-8"
    >
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-tint text-primary">
        <Construction className="size-5" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold text-ink">{section} is not built yet</h2>
      <p className="max-w-prose text-[15px] leading-relaxed text-muted">
        This screen arrives in Phase 8 of the build. The layout, navigation and status bar around it
        are the shared Corex app shell.
      </p>
    </section>
  );
}
