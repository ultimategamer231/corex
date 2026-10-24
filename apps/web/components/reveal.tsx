import type * as React from "react";

/**
 * Content that fades and lifts into view once (transform and opacity only,
 * ease-out, 500ms), driven by RevealObserver and the [data-reveal] rules in
 * globals.css. Content is visible without JavaScript and with reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}) {
  const Component = as;
  return (
    <Component
      data-reveal=""
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </Component>
  );
}
