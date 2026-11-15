import { keepAlive, supabaseTouch } from "@corex/core/keepalive";

// Called daily by the Vercel cron in vercel.json so the website's free Supabase project
// (corex_web, shared with Corex Admin) never pauses (packages/core/src/keepalive.ts).
export const GET = keepAlive(() =>
  supabaseTouch(process.env, { schema: process.env.LEADS_SCHEMA || "corex_web", table: "leads" }),
);
