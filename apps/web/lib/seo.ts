import type { Metadata } from "next";
import { site } from "@/content/site";

/** Public URL of the website, for canonical links, sitemap and Open Graph. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const domain =
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    `https://${env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "corex.example"}`;
  return domain.replace(/\/$/, "");
}

/** Unique title, description, canonical URL and social cards for one page. */
export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteUrl()}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: site.name, type: "website", locale: "en_LR" },
    twitter: { card: "summary", title, description },
    robots: noIndex ? { index: false, follow: true } : undefined,
  };
}
