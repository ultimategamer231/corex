import type { MetadataRoute } from "next";

/** The admin is internal: no search engine may crawl it (SPEC-ADMIN.md 2). */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
