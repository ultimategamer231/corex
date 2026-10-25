import type { DemoInstance } from "@corex/core/demo";

/** Shown when a visitor tries something the demo turns off (SPEC.md 11.3). */
export const DEMO_DISABLED = "This is turned off in the demo.";

/** Largest export the demo allows (SPEC.md 11.3). */
export const DEMO_EXPORT_ROWS = 200;

/** The Clinic demo, or null outside DEMO_MODE. The Clinic demo is built in Phase 11. */
export function demoInstance(): DemoInstance | null {
  return null;
}

/** "Get this system": the website quote page with this product prefilled. */
export function quoteUrl(demo: DemoInstance): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "corex.example";
  return `https://${root}/contact?product=${demo.quoteProduct}&from=demo-${demo.name}`;
}
