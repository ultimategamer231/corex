import { demoSteps } from "@corex/core/demo";
import { DemoBanner, DemoStepTracker, GlobalSearch } from "@corex/ui/shell";
import type * as React from "react";
import { signOut } from "../(auth)/actions";
import { searchAll } from "./search-actions";
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
  const nav = navFor(member.roles);
  return (
    <OfflineShell
      userId={member.userId}
      sync={syncOutbox}
      signOut={signOut}
      banner={demo ? <DemoBanner quoteUrl={quoteUrl(demo)} /> : undefined}
      org={{ name: settings.orgName, logoUrl: null, corexBrand: Boolean(demo) }}
      nav={nav}
      topBarActions={
        <GlobalSearch
          search={searchAll}
          groups={[
            ["patient", "Patients"],
            ["page", "Pages"],
          ]}
          description="Patients by name, number or phone, and pages."
          placeholder="Name, patient number, phone or page"
        />
      }
      user={{ displayName: member.displayName, roleLabel: roleLabel(member.roles) }}
    >
      {demo ? (
        <DemoStepTracker
          storageKey={`corex-demo-${demo.name}`}
          steps={demoSteps(
            demo,
            nav.map((n) => n.href),
          )}
        />
      ) : null}
      {children}
    </OfflineShell>
  );
}
