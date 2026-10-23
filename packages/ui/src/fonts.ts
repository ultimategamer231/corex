import { Inter, Plus_Jakarta_Sans } from "next/font/google";

// SPEC.md 5.4: Plus Jakarta Sans for headings, Inter for body. Self-hosted by
// next/font at build time; no request to Google from the browser.
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
  variable: "--font-jakarta",
});

/** Class names that define the font CSS variables. Put on <html>. */
export const fontVariables = `${inter.variable} ${jakarta.variable}`;
