import { withCorex } from "@corex/config/next";
import { withSerwist } from "@serwist/turbopack";

export default withSerwist(
  withCorex(
    {
      transpilePackages: ["@corex/core", "@corex/pdf"],
      // PDFs render on the server with react-pdf's own Node build.
      serverExternalPackages: ["@react-pdf/renderer"],
      // Patient attachments up to 10 MB travel in the form (CLN-06, lib/files.ts).
      experimental: { serverActions: { bodySizeLimit: "11mb" } },
    },
    { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL },
  ),
);
