import { createSerwistRoute } from "@serwist/turbopack";

// Serves the service worker built from app/sw.ts (SPEC.md 10.2).
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
    // A new build replaces the cached offline page.
    additionalPrecacheEntries: [
      { url: "/~offline", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID() },
    ],
  },
);
