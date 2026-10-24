import { type NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** Email links (password reset) land here with a one-time code for a session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const target = request.nextUrl.clone();
  target.search = "";
  target.pathname = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(target);
  }
  target.pathname = "/login";
  return NextResponse.redirect(target);
}
