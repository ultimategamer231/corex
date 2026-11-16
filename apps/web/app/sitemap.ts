import type { MetadataRoute } from "next";
import { legalOrder } from "@/content/legal";
import { productOrder } from "@/content/products";
import { serviceOrder } from "@/content/services";
import { siteUrl } from "@/lib/seo";
import { allWork } from "@/lib/work";

// Draft use cases are left out (master prompt, SEO).
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
    ...legalOrder.map((doc) => `/legal/${doc}`),
  ];
  const lastModified = new Date();
  const priority = (path: string) =>
    path === "/"
      ? 1
      : path.startsWith("/software") || path === "/pricing"
        ? 0.9
        : path.startsWith("/legal")
          ? 0.3
          : 0.7;
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: priority(path),
  }));
}
