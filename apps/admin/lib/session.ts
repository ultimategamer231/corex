import { redirect } from "next/navigation";
import { cache } from "react";
import { requestContext, type RequestContext } from "./request-context";
import { type AdminDb, getServiceSupabase, getSupabase } from "./supabase";

export type CurrentAdmin = {
  id: string;
  userId: string;
  username: string;
  name: string;
  email: string | null;
};

export type AdminSession = {
  supabase: AdminDb;
  admin: CurrentAdmin;
  context: RequestContext;
  /** Service-role client that names this admin in the activity log. */
  service: () => AdminDb;
};

export type AuthReason = "signed-out" | "verify" | "timeout" | "no-access";

export class AdminAuthError extends Error {
  override name = "AdminAuthError";
  constructor(readonly reason: AuthReason) {
    super(
      reason === "verify"
        ? "Enter the code from your authenticator app first."
        : reason === "timeout"
          ? "Your session ended after a period without activity. Sign in again."
          : reason === "no-access"
            ? "This account does not have access to the admin."
            : "Please sign in.",
    );
  }
}

const STATE_REASON: Record<string, AuthReason> = {
  unverified: "verify",
  expired: "timeout",
  not_admin: "no-access",
};

export function loginPathFor(reason: AuthReason): string {
  return reason === "verify" ? "/login/verify" : `/login?reason=${reason}`;
}

/**
 * The signed-in admin, after the same check the database applies (AUTH-01): an active
 * admin whose session passed the authenticator step and is within the inactivity
 * limit. Throws AdminAuthError otherwise.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AdminAuthError("signed-out");
  const { data: state, error } = await supabase.rpc("admin_session_state");
  if (error) throw new AdminAuthError("signed-out");
  if (state !== "ok") throw new AdminAuthError(STATE_REASON[String(state)] ?? "no-access");
  const { data: row } = await supabase
    .from("admins")
    .select("id, user_id, username, name, email")
    .eq("user_id", user.id)
    .single();
  if (!row) throw new AdminAuthError("no-access");
  const context = await requestContext();
  const admin: CurrentAdmin = {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    email: row.email,
  };
  return { supabase, admin, context, service: () => getServiceSupabase(context, admin.userId) };
}

/** For pages: the admin for this request, or a redirect to the right sign-in step. */
export const getAdminSession = cache(async (): Promise<AdminSession> => {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) redirect(loginPathFor(error.reason));
    throw error;
  }
});
