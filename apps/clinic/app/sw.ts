/// <reference lib="webworker" />
// Service worker (SPEC.md 10.2): caches the app shell and static assets, keeps the
// pages last opened online for use offline, and shows /~offline for any other page.
import { defaultCache } from "@serwist/turbopack/worker";
import { NetworkOnly, type PrecacheEntry, Serwist, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Requests that always go to the network and are never kept on the device. */
const NEVER_STORED: ((options: { url: URL; sameOrigin: boolean }) => boolean)[] = [
  // PDFs and exports carry personal data; files are served from storage on another origin.
  ({ url: { pathname } }) => pathname.endsWith("/pdf") || pathname.endsWith("/export"),
  ({ sameOrigin }) => !sameOrigin,
  // Clinical notes are never stored on the device (SPEC.md 10.1): visits, and patient
  // records, which show the latest assessment and attachments to clinicians.
  ({ url: { pathname } }) =>
    pathname.startsWith("/encounters/") || /^\/patients\/[0-9a-f-]{36}(\/|$)/i.test(pathname),
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...NEVER_STORED.map((matcher) => ({ matcher, handler: new NetworkOnly() })),
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
