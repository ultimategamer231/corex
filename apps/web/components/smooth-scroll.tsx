"use client";

import { useEffect } from "react";

/**
 * Lenis smooth scrolling (no scroll-jacking); off for people who prefer reduced
 * motion. Loaded after the page so it never delays the first paint.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stopped = false;
    let frame = 0;
    let destroy = () => {};
    void import("lenis").then(({ default: Lenis }) => {
      if (stopped) return;
      const lenis = new Lenis({ duration: 0.9, smoothWheel: true, anchors: true });
      frame = requestAnimationFrame(function raf(time) {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      });
      destroy = () => lenis.destroy();
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      destroy();
    };
  }, []);
  return null;
}
