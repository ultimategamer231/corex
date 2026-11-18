"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/** The longest the bar stays if a page never arrives (for example a failed request). */
const GIVE_UP_MS = 15_000;

/** True for a plain click on a link to another page of this site. */
function startsNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Files such as PDFs and CSV exports are downloads, not pages.
  if (/\/(pdf|export)(\/|$)|\.(pdf|csv|xlsx)$/i.test(url.pathname)) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  // The page the tap was made on. The bar shows while that page is still on screen, so
  // it goes as soon as the new page arrives.
  const [from, setFrom] = useState<string | null>(null);
  const loading = from === here;
  const current = useRef(here);
  useEffect(() => {
    current.current = here;
  }, [here]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (startsNavigation(event)) setFrom(current.current);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!loading) return;
    // The page being left fades a little (AppShell's main area), so the tap shows at once.
    const main = document.getElementById("main");
    main?.setAttribute("aria-busy", "true");
    const timer = window.setTimeout(() => setFrom(null), GIVE_UP_MS);
    return () => {
      main?.removeAttribute("aria-busy");
      window.clearTimeout(timer);
    };
  }, [loading]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60]">
      {loading ? (
        <>
          <span className="sr-only">Loading page</span>
          <div className="h-1 overflow-hidden bg-tint">
            <div className="h-full w-1/3 animate-[corex-progress_1.1s_ease-in-out_infinite] bg-accent motion-reduce:w-full motion-reduce:animate-none" />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * A thin moving bar at the top of the screen, and the current page faded, from the moment
 * a link to another page is tapped until that page appears, so every menu item and link
 * shows it is working. (Route loading.tsx files are not used: they stream the page, and
 * a page that answers "not found" would then send status 200 instead of 404.)
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
