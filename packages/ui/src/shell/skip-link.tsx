/** First focusable element on every page: jumps keyboard users past the navigation. */
export function SkipLink({ targetId = "main" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="bg-primary text-primary-foreground fixed top-2 left-2 z-[60] -translate-y-24 rounded-lg px-4 py-3 font-semibold focus-visible:translate-y-0"
    >
      Skip to main content
    </a>
  );
}
