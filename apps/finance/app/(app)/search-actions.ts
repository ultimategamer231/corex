"use server";

import type { SearchHit } from "@corex/ui/shell";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";
import { navFor } from "@/lib/shell";

/** Characters with a meaning in a PostgREST filter are dropped from the search text. */
function clean(text: string): string {
  return text
    .replace(/[,()%*\\:."']/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Top bar search as the signed-in member; row-level security applies. Customers and
 * vendors by name, invoices by number or customer, and the pages in the member's menu.
 */
export async function searchAll(text: string): Promise<SearchHit[]> {
  const term = clean(text);
  if (term.length < 2) return [];
  const { supabase, member } = await getSession();
  const lower = term.toLowerCase();
  const pages: SearchHit[] = navFor(member.roles)
    .filter((n) => n.label.toLowerCase().includes(lower))
    .map((n) => ({ kind: "page", id: n.href, title: n.label, detail: "Page", href: n.href }));
  const parties = rows(
    await supabase
      .from("counterparties")
      .select("id, name, type")
      .ilike("name", `%${term}%`)
      .order("name")
      .limit(6),
  );
  const hits: SearchHit[] = parties.map((c) => ({
    kind: "party",
    id: c.id,
    title: c.name,
    detail: c.type === "vendor" ? "Vendor" : c.type === "both" ? "Customer and vendor" : "Customer",
    href: "/counterparties",
  }));
  if (memberHas(member, MANAGER)) {
    const number = /^\d+$/.test(term) ? Number(term) : null;
    let query = supabase
      .from("invoices")
      .select("id, number, party_id, status")
      .not("number", "is", null)
      .order("number", { ascending: false })
      .limit(6);
    if (number !== null) query = query.eq("number", number);
    else if (parties.length > 0)
      query = query.in(
        "party_id",
        parties.map((c) => c.id),
      );
    const invoices = number !== null || parties.length > 0 ? rows(await query) : [];
    const name = new Map(parties.map((c) => [c.id, c.name]));
    hits.push(
      ...invoices.map((i) => ({
        kind: "invoice",
        id: i.id,
        title: `Invoice No. ${i.number}`,
        detail: [name.get(i.party_id ?? ""), i.status.replace("_", " ")]
          .filter(Boolean)
          .join(" · "),
        href: `/invoices/${i.id}`,
      })),
    );
  }
  return [...hits, ...pages];
}
