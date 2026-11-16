import type { Metadata } from "next";
import { site } from "@/content/site";

/** Public URL of the website, for canonical links, sitemap and Open Graph. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const domain =
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    `https://${env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "corexlr.com"}`;
  return domain.replace(/\/$/, "");
}

/** Unique title, description, canonical URL and social cards for one page. */
export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  /** Use the title as written, without the " | Corex" suffix (the home page). */
  absoluteTitle?: boolean;
}): Metadata {
  const url = `${siteUrl()}${path}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    // A page's own openGraph replaces the parent's, so the shared card image
    // (app/opengraph-image.tsx) is named here for every page.
    openGraph: {
      title,
      description,
      url,
      siteName: site.name,
      type: "website",
      locale: "en_LR",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: site.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/twitter-image"] },
    robots: noIndex ? { index: false, follow: true } : undefined,
  };
}

/** Stable ids that tie the structured data on every page to one company and one website. */
export function schemaIds() {
  const base = siteUrl();
  return { organization: `${base}/#organization`, website: `${base}/#website` };
}

/** Absolute URL for a site path, for structured data. */
export function absoluteUrl(path: string) {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
