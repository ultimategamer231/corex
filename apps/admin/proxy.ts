import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/** Pages reachable without signing in; /i/ is the client view of one invoice (LINK-02). */
const PUBLIC_PATHS = ["/forgot-password", "/reset-password", "/invite/", "/i/"];

function isPublic(path: string): boolean {
  return path === "/login" || PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));
}

/**
 * Refreshes the Supabase session cookie on every request and enforces the admin sign-in
 * steps (AUTH-01, AUTH-05): signed out goes to /login; a password-only session goes to
 * /login/verify; a session idle past the limit, or of an admin who was removed, is ended.
 * Server actions and row-level security check again.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    db: { schema: process.env.NEXT_PUBLIC_DB_SCHEMA || "corex_web" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const redirectTo = (pathname: string, search = "") => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = search;
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (isPublic(path)) return response;
  if (!user) {
    return redirectTo("/login", path === "/" ? "" : `?next=${encodeURIComponent(path)}`);
  }

  const result: { data: unknown } = await supabase.rpc("admin_session_state");
  const state = result.data;
  if (state === "ok") {
    return path.startsWith("/login") ? redirectTo("/") : response;
  }
  if (state === "unverified") {
    return path === "/login/verify" ? response : redirectTo("/login/verify");
  }
  await supabase.auth.signOut({ scope: "local" });
  return redirectTo("/login", `?reason=${state === "expired" ? "timeout" : "no-access"}`);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)"],
};
