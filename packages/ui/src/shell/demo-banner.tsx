import { ArrowUpRight } from "lucide-react";

export type DemoBannerProps = {
  /** Website quote page with this product prefilled. */
  quoteUrl: string;
};

/** Shown on every screen of a public demo (SPEC.md 11.3). */
export function DemoBanner({ quoteUrl }: DemoBannerProps) {
  return (
    <aside
      aria-label="Demo notice"
      className="dark-surface flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-primary-dark px-4 py-1.5 text-center text-sm text-white"
    >
      <p className="font-medium">Demo with sample data. Resets every night.</p>
      <a
        href={quoteUrl}
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-white underline underline-offset-4 hover:no-underline"
      >
        Get this system
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </a>
    </aside>
  );
}
