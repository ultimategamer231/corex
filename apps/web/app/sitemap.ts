import type { MetadataRoute } from "next";
import { productOrder } from "@/content/products";
import { serviceOrder } from "@/content/services";
import { siteUrl } from "@/lib/seo";
import { allWork } from "@/lib/work";

// Draft use cases and draft legal pages are left out (master prompt, SEO).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const published = allWork(false);
  const paths = [
    "/",
    "/software",
    ...productOrder.map((p) => `/software/${p}`),
    "/software/on-request",
    ...serviceOrder.map((s) => `/services/${s}`),
    ...(published.length > 0 ? ["/work", ...published.map((w) => `/work/${w.slug}`)] : []),
    "/pricing",
    "/about",
    "/contact",
  ];
  const lastModified = new Date();
  const priority = (path: string) =>
    path === "/" ? 1 : path.startsWith("/software") || path === "/pricing" ? 0.9 : 0.7;
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: priority(path),
  }));
}
