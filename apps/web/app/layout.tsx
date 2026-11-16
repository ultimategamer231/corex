import { fontVariables } from "@corex/ui/fonts";
import { SkipLink } from "@corex/ui/shell";
import type { Metadata, Viewport } from "next";
import type * as React from "react";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RevealObserver } from "@/components/reveal-observer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { site } from "@/content/site";
import { siteUrl } from "@/lib/seo";
import { siteGraph } from "@/lib/structured-data";
import { hasPublishedWork } from "@/lib/work";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${site.shortName}: ${site.tagline}`, template: `%s | ${site.shortName}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: siteUrl() }],
  creator: site.name,
  publisher: site.name,
  category: "technology",
  keywords: [
    "school management software Liberia",
    "school management system Liberia",
    "college management system",
    "clinic management software Liberia",
    "accounting software Liberia",
    "software company Monrovia",
    "custom software development Liberia",
    "Corex Digital Solutions",
  ],
  openGraph: { siteName: site.name, locale: "en_LR", type: "website" },
  twitter: { card: "summary_large_image" },
  // Search console ownership checks, set in Vercel when the owner registers the site.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = { themeColor: "#0B6A67" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const showWork = hasPublishedWork();
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <JsonLd data={siteGraph()} />
        <SkipLink />
        <SmoothScroll />
        <RevealObserver />
        <SiteHeader showWork={showWork} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter showWork={showWork} />
      </body>
    </html>
  );
}
