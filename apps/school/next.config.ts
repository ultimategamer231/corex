import { withCorex } from "@corex/config/next";

export default withCorex({}, { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
