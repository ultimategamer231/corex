"use client";

import { useEffect } from "react";

/**
 * Reveals [data-reveal] elements as they scroll into view. Elements already on
 * screen when the page loads are shown at once, so nothing visible flickers and
 * the first paint never waits for this script.
 */
export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reveal = (el: Element) => el.setAttribute("data-revealed", "");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2 },
    );
    const scan = () => {
      for (const el of document.querySelectorAll(
        "[data-reveal]:not([data-revealed]):not([data-reveal-watched])",
      )) {
        el.setAttribute("data-reveal-watched", "");
        if (el.getBoundingClientRect().top < window.innerHeight) reveal(el);
        else io.observe(el);
      }
    };
    scan();
    document.documentElement.classList.add("reveal-ready");
    // Pages reached by client navigation, and lists that change, add new elements.
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      document.documentElement.classList.remove("reveal-ready");
    };
  }, []);
  return null;
}
