import type * as React from "react";
import { SubNav } from "@/components/sub-nav";
import { BURSAR } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";

const ITEMS = [
  { href: "/fees", label: "Overview" },
  { href: "/fees/invoices", label: "Invoices" },
  { href: "/fees/structures", label: "Fee structures" },
];

export default async function FeesLayout({ children }: { children: React.ReactNode }) {
  const { member } = await getSession();
  return (
    <>
      {memberHas(member, BURSAR) ? <SubNav label="Fees" items={ITEMS} /> : null}
      {children}
    </>
  );
}
