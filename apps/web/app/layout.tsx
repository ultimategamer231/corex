import { fontVariables } from "@corex/ui/fonts";
import { SkipLink } from "@corex/ui/shell";
import type { Metadata, Viewport } from "next";
import type * as React from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RevealObserver } from "@/components/reveal-observer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { site } from "@/content/site";
import { siteUrl } from "@/lib/seo";
import { hasPublishedWork } from "@/lib/work";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${site.shortName}: ${site.tagline}`, template: `%s | ${site.shortName}` },
  description: site.description,
  applicationName: site.name,
};

export const viewport: Viewport = { themeColor: "#0B6A67" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const showWork = hasPublishedWork();
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
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
