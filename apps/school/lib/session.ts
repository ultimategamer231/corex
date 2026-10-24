import { AuthError, type CurrentMember, requireMember, SESSION_HOURS } from "@corex/core/auth";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { hasAnyRole, type Role } from "./roles";
import { asAuthClient, getSupabase, type SchoolDb } from "./supabase";

export type Session = { supabase: SchoolDb; member: CurrentMember };

/**
 * The signed-in member for this request. Signed out or past the 8-hour session
 * (SPEC.md 5.3): back to the login page. Not an active member: the login page
 * explains. Cached per request.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await getSupabase();
  try {
    const member = await requireMember(asAuthClient(supabase), {
      sessionHours: SESSION_HOURS.school,
    });
    return { supabase, member };
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.status === 401 ? "/login?reason=signed-out" : "/login?reason=no-access");
    }
    throw error;
  }
});

/** The session when the member holds one of `roles`; other members get a 404. */
export async function requireRoles(roles: readonly Role[]): Promise<Session> {
  const session = await getSession();
  if (!hasAnyRole(session.member.roles, roles)) notFound();
  return session;
}

export function memberHas(member: CurrentMember, roles: readonly Role[]): boolean {
  return hasAnyRole(member.roles, roles);
}
