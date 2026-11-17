"use server";

import type { SearchHit } from "@corex/ui/shell";
import { personName } from "@/lib/format";
import { searchPatients, searchTerm } from "@/lib/patients";
import { rows } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { navFor } from "@/lib/shell";

/**
 * Top bar search as the signed-in member; row-level security applies. Patients by name,
 * patient number or phone, and the pages in the member's own menu.
 */
export async function searchAll(text: string): Promise<SearchHit[]> {
  const term = searchTerm(text);
  if (term.length < 2) return [];
  const { supabase, member } = await getSession();
  const lower = term.toLowerCase();
  const pages: SearchHit[] = navFor(member.roles)
    .filter((n) => n.label.toLowerCase().includes(lower))
    .map((n) => ({ kind: "page", id: n.href, title: n.label, detail: "Page", href: n.href }));
  const patients = rows(await searchPatients(supabase, term, 8));
  return [
    ...patients.map((p) => ({
      kind: "patient",
      id: p.id,
      title: personName(p),
      detail: [p.patient_number, p.phone].filter(Boolean).join(" · "),
      href: `/patients/${p.id}`,
    })),
    ...pages,
  ];
}
