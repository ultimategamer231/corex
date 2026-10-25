import type { MetadataRoute } from "next";

/** Installable app (SPEC.md 10.2): Windows, Android and other platforms. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "School Management",
    short_name: "School",
    description: "School Management by Corex Digital Solutions.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6FAF9",
    theme_color: "#064644",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
