"use server";

import { z } from "zod";
import { AdminAuthError, requireAdmin } from "@/lib/session";

export type SearchResult = {
  kind: "lead" | "client" | "invoice" | "receipt";
  id: string;
  title: string;
  detail: string;
  href: string;
};

const query = z.string().trim().min(2).max(100);

/** Global search (SPEC-ADMIN.md 11), as the signed-in admin; row-level security applies. */
export async function searchAll(text: string): Promise<SearchResult[]> {
  const parsed = query.safeParse(text);
  if (!parsed.success) return [];
  try {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.rpc("admin_search", { p_query: parsed.data });
    return (data ?? []) as SearchResult[];
  } catch (error) {
    if (error instanceof AdminAuthError) return [];
    throw error;
  }
}

/** The notifications were opened: items so far are no longer unread. */
export async function markNotificationsSeen(): Promise<void> {
  try {
    const { supabase } = await requireAdmin();
    await supabase.rpc("mark_notifications_seen", {});
  } catch (error) {
    if (!(error instanceof AdminAuthError)) throw error;
  }
}
