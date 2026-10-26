import type { Demo, DemoRole } from "@/content/products";

/** Root domain for demo subdomains (SPEC.md 11.1); a placeholder until it is decided. */
export function rootDomain(env: Record<string, string | undefined> = process.env): string {
  return env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "corex.example";
}

/**
 * Host of one demo: `<subdomain>.<root domain>`, or NEXT_PUBLIC_DEMO_HOST_PATTERN with
 * `{subdomain}` replaced, for demos hosted before the domain exists
 * (for example `corex-{subdomain}.vercel.app`).
 */
export function demoHost(
  demo: Pick<Demo, "subdomain">,
  env: Record<string, string | undefined> = process.env,
): string {
  const pattern = env.NEXT_PUBLIC_DEMO_HOST_PATTERN?.trim();
  if (pattern) return pattern.replaceAll("{subdomain}", demo.subdomain);
  return `${demo.subdomain}.${rootDomain(env)}`;
}

/** "Log in as" link: the demo's login page with the role preselected (SPEC.md 6.3, 11.2). */
export function demoLoginUrl(
  demo: Pick<Demo, "subdomain">,
  role: DemoRole,
  env?: Record<string, string | undefined>,
): string {
  return `https://${demoHost(demo, env)}/login?role=${encodeURIComponent(role.slug)}`;
}
