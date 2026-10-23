import { Toaster } from "@corex/ui/components/sonner";
import { fontVariables } from "@corex/ui/fonts";
import type { Metadata, Viewport } from "next";
import type * as React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Financial Management", template: "%s | Financial Management" },
  description: "Financial Management by Corex Digital Solutions.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#064644" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
