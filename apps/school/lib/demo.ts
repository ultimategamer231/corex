import { DEMOS, type DemoInstance } from "@corex/core/demo";
import { isDemoMode } from "@corex/core/env";

/** Shown when a visitor tries something the demo turns off (SPEC.md 11.3). */
export const DEMO_DISABLED = "This is turned off in the demo.";

/**
 * This instance's public demo, or null outside DEMO_MODE. Reads only DEMO_MODE and
 * EDITION, so sign-in pages work before the rest of the environment is checked.
 */
export function demoInstance(): DemoInstance | null {
  if (!isDemoMode(process.env)) return null;
  return DEMOS[process.env.EDITION === "highschool" ? "highschool" : "college"];
}

/** "Get this system": the website quote page with this product prefilled. */
export function quoteUrl(demo: DemoInstance): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "corex.example";
  return `https://${root}/contact?product=${demo.quoteProduct}&from=demo-${demo.name}`;
}
