import { withCorex } from "@corex/config/next";

export default withCorex(
  {
    transpilePackages: ["@corex/core", "@corex/pdf"],
    // PDFs render on the server with react-pdf's own Node build.
    serverExternalPackages: ["@react-pdf/renderer"],
    // The admin is internal: search engines are told not to index any response
    // (SPEC-ADMIN.md 2), on top of robots.txt.
    async headers() {
      return [
        { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      ];
    },
  },
  { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL },
);
