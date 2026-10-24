import { DEMOS, type DemoInstance } from "@corex/core/demo";
import { schoolEnv } from "./env";

/** Shown when a visitor tries something the demo turns off (SPEC.md 11.3). */
export const DEMO_DISABLED = "This is turned off in the demo.";

/** This instance's public demo, or null outside DEMO_MODE. */
export function demoInstance(): DemoInstance | null {
  const env = schoolEnv();
  return env.demo ? DEMOS[env.edition] : null;
}

/** "Get this system": the website quote page with this product prefilled. */
export function quoteUrl(demo: DemoInstance): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "corex.example";
  return `https://${root}/contact?product=${demo.quoteProduct}&from=demo-${demo.name}`;
}
