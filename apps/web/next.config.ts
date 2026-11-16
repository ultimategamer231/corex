import { withCorex } from "@corex/config/next";

export default withCorex(
  {},
  {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Cloudflare Web Analytics beacon and its reporting endpoint (components/analytics.tsx).
    scriptSrc: ["https://static.cloudflareinsights.com"],
    connectSrc: ["https://cloudflareinsights.com"],
  },
);
