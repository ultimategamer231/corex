/** First focusable element on every page: jumps keyboard users past the navigation. */
export function SkipLink({ targetId = "main" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="fixed top-2 left-2 z-[60] -translate-y-24 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus-visible:translate-y-0"
    >
      Skip to main content
    </a>
  );
}
