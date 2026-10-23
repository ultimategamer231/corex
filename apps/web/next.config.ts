import { withCorex } from "@corex/config/next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export default withCorex(
  {},
  { connectSrc: supabaseUrl ? [supabaseUrl, supabaseUrl.replace(/^http/, "ws")] : [] },
);
