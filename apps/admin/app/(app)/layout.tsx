import { AppShell } from "@corex/ui/shell";
import type * as React from "react";
import { signOut } from "../(auth)/actions";
import { getAdminSession } from "@/lib/session";
import { NAV } from "@/lib/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await getAdminSession();
  return (
    <AppShell
      org={{ name: "Corex Admin", logoUrl: "/icon.svg" }}
      nav={NAV}
      user={{ displayName: admin.name, roleLabel: "Admin" }}
      showConnection={false}
      onSignOut={signOut}
    >
      {children}
    </AppShell>
  );
}
