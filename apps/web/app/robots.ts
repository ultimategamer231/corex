import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/**
 * Search engines and AI assistants are welcome on every public page; only the form
 * endpoints are left out. The AI crawlers are named so the welcome is explicit.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
    "Bingbot",
  ];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      { userAgent: aiCrawlers, allow: "/", disallow: "/api/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
