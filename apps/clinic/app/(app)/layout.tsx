import { AppShell } from "@corex/ui/shell";
import type * as React from "react";
import { getCurrentUser, getOrg, nav } from "@/lib/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [org, user] = await Promise.all([getOrg(), getCurrentUser()]);
  return (
    <AppShell org={org} nav={nav} user={user}>
      {children}
    </AppShell>
  );
}
