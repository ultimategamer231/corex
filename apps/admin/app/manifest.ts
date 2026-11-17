import type { MetadataRoute } from "next";

/**
 * Installable admin (audit round): "Install app" in Chrome or Edge, or "Add to Home
 * Screen" on a phone, opens the admin in its own window. There is no service worker, so
 * nothing from the admin is kept on the device for offline use.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Corex Admin",
    short_name: "Corex Admin",
    description: "The Corex back office: leads, clients, invoices and subscriptions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6FAF9",
    theme_color: "#064644",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
