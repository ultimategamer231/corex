import { withCorex } from "@corex/config/next";

export default withCorex(
  {
    transpilePackages: ["@corex/core", "@corex/pdf"],
    // PDFs render on the server with react-pdf's own Node build.
    serverExternalPackages: ["@react-pdf/renderer"],
    // Receipt photos up to 5 MB travel in the form (lib/files.ts).
    experimental: { serverActions: { bodySizeLimit: "6mb" } },
  },
  { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL },
);
