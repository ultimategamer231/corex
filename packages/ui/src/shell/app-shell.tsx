"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";
import { BottomNav } from "./bottom-nav";
import { OnlineStatus } from "./online-status";
import { SidebarNav } from "./sidebar-nav";
import { SkipLink } from "./skip-link";
import { TopBar } from "./top-bar";
import type { ShellNavItem, ShellOrg, ShellUser } from "./types";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";
import { UserMenu } from "./user-menu";

export type AppShellProps = {
  org: ShellOrg;
  nav: ShellNavItem[];
  user: ShellUser;
  /** Records waiting in the offline outbox. */
  pendingSyncCount?: number;
  /** Show the online/offline badge (default true; apps without offline mode turn it off). */
  showConnection?: boolean;
  /** Full-width notice above the top bar, for example the demo banner (SPEC.md 11.3). */
  banner?: React.ReactNode;
  /** Extra user-menu items. */
  userMenuItems?: React.ReactNode;
  /** Controls in the top bar before the user menu, for example search and notifications. */
  topBarActions?: React.ReactNode;
  onSignOut?: () => void | Promise<void>;
  children: React.ReactNode;
};

/**
 * Layout for every Corex app (SPEC.md 5.4): sidebar on desktop, bottom bar on
 * mobile, top bar with organization, connection status and user menu.
 */
export function AppShell({
  org,
  nav,
  user,
  pendingSyncCount = 0,
  showConnection = true,
  banner,
  userMenuItems,
  topBarActions,
  onSignOut,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <SkipLink />
      {banner}
      <TopBar org={org}>
        {topBarActions}
        {showConnection ? <OnlineStatus pendingCount={pendingSyncCount} /> : null}
        <UserMenu user={user} onSignOut={onSignOut}>
          {userMenuItems}
        </UserMenu>
      </TopBar>
      <div className="flex flex-1">
        <SidebarNav
          items={nav}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-6 pb-24 outline-none md:px-8 md:pt-8 md:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomNav items={nav} pathname={pathname} />
    </div>
  );
}
