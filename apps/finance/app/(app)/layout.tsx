import { AppShell } from "@corex/ui/shell";
import type * as React from "react";
import { signOut } from "../(auth)/actions";
import { getSettings } from "@/lib/org";
import { roleLabel } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { navFor } from "@/lib/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member } = await getSession();
  const settings = await getSettings();
  return (
    <AppShell
      org={{ name: settings.orgName, logoUrl: null }}
      nav={navFor(member.roles)}
      user={{ displayName: member.displayName, roleLabel: roleLabel(member.roles) }}
      onSignOut={signOut}
    >
      {children}
    </AppShell>
  );
}
