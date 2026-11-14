import { keepAlive, supabaseTouch } from "@corex/core/keepalive";

// Called daily by the Vercel cron in vercel.json so this instance's free Supabase project
// never pauses (packages/core/src/keepalive.ts).
export const GET = keepAlive(() =>
  supabaseTouch(process.env, {
    schema: process.env.DB_SCHEMA || process.env.NEXT_PUBLIC_DB_SCHEMA,
    table: "settings",
  }),
);
