"use client";

import { LoaderCircle } from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";

/** How long "Preparing..." shows at most; a PDF is usually ready well before. */
const SHOW_MS = 6000;

/**
 * A link to a PDF that says "Preparing..." from the tap until the file arrives (the page
 * loses focus as the file opens) or a few seconds pass, so a slow PDF never looks stuck.
 */
export function DownloadLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const done = () => setPending(false);
    const timer = window.setTimeout(done, SHOW_MS);
    window.addEventListener("blur", done);
    document.addEventListener("visibilitychange", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", done);
      document.removeEventListener("visibilitychange", done);
    };
  }, [pending]);

  return (
    <a
      href={href}
      className={className}
      aria-busy={pending || undefined}
      onClick={() => setPending(true)}
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          Preparing...
        </>
      ) : (
        children
      )}
    </a>
  );
}
