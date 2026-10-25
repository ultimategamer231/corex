import { DemoBanner } from "@corex/ui/shell";
import type * as React from "react";
import { signOut } from "../(auth)/actions";
import { syncOutbox } from "./sync-actions";
import { OfflineShell } from "@/components/offline-shell";
import { demoInstance, quoteUrl } from "@/lib/demo";
import { getSettings } from "@/lib/org";
import { roleLabel } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { navFor } from "@/lib/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { member } = await getSession();
  const settings = await getSettings();
  const demo = demoInstance();
  return (
    <OfflineShell
      userId={member.userId}
      sync={syncOutbox}
      signOut={signOut}
      banner={demo ? <DemoBanner quoteUrl={quoteUrl(demo)} /> : undefined}
      org={{ name: settings.orgName, logoUrl: null }}
      nav={navFor(member.roles)}
      user={{ displayName: member.displayName, roleLabel: roleLabel(member.roles) }}
    >
      {children}
    </OfflineShell>
  );
}
