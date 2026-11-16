import Script from "next/script";

/**
 * Cloudflare Web Analytics: counts visits without cookies (privacy policy). Loads only
 * when the site token from Cloudflare is set (docs/seo.md, "Visitor analytics").
 */
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!token) return null;
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
