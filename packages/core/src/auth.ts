// Server-side identity and permission checks (SPEC.md 4.3.5, 5.3). Row-level security
// is the last line of defense; server code checks roles before every write too (CORE-02).

export class AuthError extends Error {
  override name = "AuthError";
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export type Membership = { role: string; status: "active" | "suspended"; displayName: string };

export type CurrentMember = {
  userId: string;
  email: string | null;
  displayName: string;
  /** Active roles in this schema. */
  roles: string[];
  lastSignInAt: string | null;
};

/** Minimal Supabase surface used here, so tests can pass a fake. */
export type AuthClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string; email?: string; last_sign_in_at?: string } | null };
      error: unknown;
    }>;
  };
  from(table: "memberships"): {
    select(columns: string): {
      eq(
        column: "user_id",
        value: string,
      ): PromiseLike<{
        data: { role: string; status: string; display_name: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

/** Session length per product (SPEC.md 5.3). */
export const SESSION_HOURS = { school: 8, finance: 8, clinic: 4 } as const;

/** True when a session started more than `maxHours` ago. */
export function isSessionExpired(
  lastSignInAt: string | null,
  maxHours: number,
  now = new Date(),
): boolean {
  if (!lastSignInAt) return true;
  const started = new Date(lastSignInAt).getTime();
  if (Number.isNaN(started)) return true;
  return now.getTime() - started > maxHours * 60 * 60 * 1000;
}

/**
 * The signed-in user with an active membership in this schema, or throws:
 * 401 when signed out or the session is too old, 403 when not an active member or
 * missing every role in `roles`. A suspended member is refused even with a valid
 * session (SPEC.md 5.3).
 */
export async function requireMember(
  supabase: AuthClient,
  options: { roles?: readonly string[]; sessionHours?: number; now?: Date } = {},
): Promise<CurrentMember> {
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) throw new AuthError("Please sign in", 401);
  const lastSignInAt = user.last_sign_in_at ?? null;
  if (
    options.sessionHours !== undefined &&
    isSessionExpired(lastSignInAt, options.sessionHours, options.now)
  ) {
    throw new AuthError("Your session has expired. Please sign in again.", 401);
  }

  const memberships = await supabase
    .from("memberships")
    .select("role, status, display_name")
    .eq("user_id", user.id);
  if (memberships.error) throw new AuthError("Could not check your access", 403);
  const active = (memberships.data ?? []).filter((m) => m.status === "active");
  if (active.length === 0) throw new AuthError("You do not have access to this organization", 403);

  const roles = active.map((m) => m.role).sort();
  if (options.roles && !options.roles.some((role) => roles.includes(role))) {
    throw new AuthError("Your role cannot do this", 403);
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: active[0]?.display_name ?? user.email ?? "User",
    roles,
    lastSignInAt,
  };
}
