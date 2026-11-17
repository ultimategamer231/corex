"use server";

import type { SearchHit } from "@corex/ui/shell";
import { personName } from "@/lib/format";
import { OFFICE } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";
import { navFor } from "@/lib/shell";
import { edition } from "@/lib/edition";

/** Characters with a meaning in a PostgREST filter are dropped from the search text. */
function clean(text: string): string {
  return text
    .replace(/[,()%*\\:."']/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Top bar search as the signed-in member; row-level security applies. Office staff find
 * students by name or number; everyone finds the pages in their own menu.
 */
export async function searchAll(text: string): Promise<SearchHit[]> {
  const term = clean(text);
  if (term.length < 2) return [];
  const { supabase, member } = await getSession();
  const lower = term.toLowerCase();
  const pages: SearchHit[] = navFor(member.roles, edition())
    .filter((n) => n.label.toLowerCase().includes(lower))
    .map((n) => ({ kind: "page", id: n.href, title: n.label, detail: "Page", href: n.href }));
  if (!memberHas(member, OFFICE)) return pages;
  let query = supabase
    .from("students")
    .select("id, student_number, first_name, middle_name, last_name, status")
    .order("last_name")
    .order("first_name")
    .limit(8);
  // Each word must match a name or the student number.
  for (const w of term.split(/\s+/).filter(Boolean).slice(0, 3)) {
    query = query.or(
      `first_name.ilike.${w}%,middle_name.ilike.${w}%,last_name.ilike.${w}%,student_number.ilike.%${w}%`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return [
    ...data.map((s) => ({
      kind: "student",
      id: s.id,
      title: personName(s),
      detail: `${s.student_number} · ${s.status}`,
      href: `/students/${s.id}`,
    })),
    ...pages,
  ];
}
