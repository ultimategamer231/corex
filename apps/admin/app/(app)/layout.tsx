import { Badge } from "@corex/ui/components/badge";
import { AppShell } from "@corex/ui/shell";
import type * as React from "react";
import { signOut } from "../(auth)/actions";
import { GlobalSearch } from "@/components/shell/global-search";
import { Notifications } from "@/components/shell/notifications";
import { unreadCount } from "@/lib/dashboard";
import { attentionItems, hasSampleData, notificationsSeenAt } from "@/lib/dashboard-data";
import { getAdminSession } from "@/lib/session";
import { NAV } from "@/lib/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { admin, supabase } = await getAdminSession();
  const [items, seenAt, sample] = await Promise.all([
    attentionItems(supabase),
    notificationsSeenAt(supabase, admin.userId),
    hasSampleData(supabase),
  ]);
  return (
    <AppShell
      org={{ name: "Corex Admin", logoUrl: "/icon.svg" }}
      nav={NAV}
      user={{ displayName: admin.name, roleLabel: "Admin" }}
      showConnection={false}
      onSignOut={signOut}
      topBarActions={
        <>
          {sample ? (
            <Badge variant="warning" className="hidden sm:inline-flex">
              Sample data
            </Badge>
          ) : null}
          <GlobalSearch />
          <Notifications items={items} unread={unreadCount(items, seenAt)} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
