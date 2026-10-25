import { Toaster } from "@corex/ui/components/sonner";
import { fontVariables } from "@corex/ui/fonts";
import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import type * as React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "School Management", template: "%s | School Management" },
  description: "School Management by Corex Digital Solutions.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#064644" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        {/* Records saved offline sync in place, so the page is not reloaded on reconnect. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          reloadOnOnline={false}
        >
          {children}
        </SerwistProvider>
        <Toaster />
      </body>
    </html>
  );
}
