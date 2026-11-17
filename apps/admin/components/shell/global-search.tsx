"use client";

import { GlobalSearch as SharedSearch } from "@corex/ui/shell";
import { searchAll } from "@/app/(app)/shell-actions";

const GROUPS = [
  ["lead", "Leads"],
  ["client", "Clients"],
  ["invoice", "Invoices"],
  ["receipt", "Receipts"],
] as const;

/** Global search (SPEC-ADMIN.md 11): Ctrl K or Cmd K, or the top bar button. */
export function GlobalSearch() {
  return (
    <SharedSearch
      search={searchAll}
      groups={GROUPS}
      description="Leads, clients, invoice and receipt numbers."
      placeholder="Name, organization, phone, email or number"
    />
  );
}
