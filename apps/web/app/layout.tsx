import { fontVariables } from "@corex/ui/fonts";
import type { Metadata, Viewport } from "next";
import type * as React from "react";
import { site } from "@/content/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${site.shortName}: ${site.tagline}`, template: `%s | ${site.shortName}` },
  description:
    "Business software for schools, clinics, businesses and NGOs in Liberia. Try a live demo before you pay.",
  // The full website is built in Phase 4; keep this placeholder out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0B6A67" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
