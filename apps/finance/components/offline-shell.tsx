"use client";

import { OfflineProvider, type SyncAction, useOffline } from "@corex/core/offline/react";
import { AppShell, type AppShellProps } from "@corex/ui/shell";
import { useRouter } from "next/navigation";

type Props = Omit<AppShellProps, "pendingSyncCount" | "onSignOut"> & {
  userId: string;
  sync: SyncAction;
  signOut: () => Promise<void>;
};

/**
 * The app shell with this user's offline outbox (SPEC.md 10.2): the top bar counts
 * records waiting to sync, and signing out clears the device after a warning.
 */
export function OfflineShell({ userId, sync, signOut, ...shell }: Props) {
  const router = useRouter();
  return (
    <OfflineProvider app="finance" userId={userId} send={sync} onSynced={() => router.refresh()}>
      <ShellWithOutbox {...shell} signOut={signOut} />
    </OfflineProvider>
  );
}

function ShellWithOutbox({
  signOut,
  ...shell
}: Omit<AppShellProps, "pendingSyncCount" | "onSignOut"> & { signOut: () => Promise<void> }) {
  const { items, clear } = useOffline();
  return (
    <AppShell
      {...shell}
      pendingSyncCount={items.length}
      onSignOut={async () => {
        if (
          items.length > 0 &&
          !window.confirm(
            `${items.length} ${items.length === 1 ? "record has" : "records have"} not reached the server yet. Signing out deletes ${items.length === 1 ? "it" : "them"} from this device. Sign out anyway?`,
          )
        ) {
          return;
        }
        await clear();
        await signOut();
      }}
    />
  );
}
