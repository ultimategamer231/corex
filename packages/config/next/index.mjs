// @ts-check
// Shared Next.js configuration for every Corex app: security headers and
// workspace package transpilation.
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} CspOptions
 * @property {string[]} [connectSrc] Extra origins for fetch/XHR/WebSocket (for example the Supabase URL).
 * @property {string[]} [imgSrc] Extra image origins.
 * @property {string} [supabaseUrl] Supabase project URL: allowed for API calls, realtime (wss) and Storage images such as the org logo.
 * @property {boolean} [dev] Development mode: allows eval for React Fast Refresh and skips upgrade-insecure-requests.
 */

/**
 * Builds the Content-Security-Policy header value.
 * Scripts and styles allow 'unsafe-inline' because Next.js injects inline
 * bootstrap scripts; nonces would force dynamic rendering (see PROGRESS.md D8).
 *
 * @param {CspOptions} [options]
 * @returns {string}
 */
export function contentSecurityPolicy({
  connectSrc = [],
  imgSrc = [],
  supabaseUrl,
  dev = false,
} = {}) {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : undefined;
  const supabaseConnect = supabase ? [supabase, supabase.replace(/^http/, "ws")] : [];
  const supabaseImg = supabase ? [supabase] : [];
  /** @type {Record<string, string[]>} */
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...supabaseImg, ...imgSrc],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabaseConnect, ...connectSrc, ...(dev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([key, values]) => `${key} ${values.join(" ")}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/**
 * Security headers applied to every route (OWASP baseline).
 *
 * @param {CspOptions} [options]
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders(options = {}) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

/**
 * Wraps an app's Next.js config with the Corex defaults.
 *
 * @param {import("next").NextConfig} config
 * @param {CspOptions} [csp]
 * @returns {import("next").NextConfig}
 */
export function withCorex(config = {}, csp = {}) {
  const dev = csp.dev ?? process.env.NODE_ENV !== "production";
  // Docker images (Dockerfile) build a self-contained server; Vercel ignores this.
  const standalone =
    process.env.NEXT_OUTPUT === "standalone"
      ? {
          output: /** @type {const} */ ("standalone"),
          outputFileTracingRoot: fileURLToPath(new URL("../../../", import.meta.url)),
        }
      : {};
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    ...standalone,
    ...config,
    transpilePackages: ["@corex/ui", ...(config.transpilePackages ?? [])],
    async headers() {
      const extra = config.headers ? await config.headers() : [];
      return [{ source: "/:path*", headers: securityHeaders({ ...csp, dev }) }, ...extra];
    },
  };
}
