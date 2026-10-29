import type { AdminDb } from "../supabase";
import { hashToken } from "./tokens";

export type LinkKind = "invite" | "password_reset" | "authenticator_setup";

/** Looks up an unused, unexpired one-time link of one of `kinds`. */
export async function findLink(service: AdminDb, token: string, kinds: LinkKind[]) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data } = await service
    .from("admin_tokens")
    .select(
      "id, kind, expires_at, used_at, admin:admins!inner(id, user_id, username, name, email, status)",
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at) <= new Date()) return null;
  if (!kinds.includes(data.kind as LinkKind)) return null;
  if (data.admin.status === "removed") return null;
  return data;
}
