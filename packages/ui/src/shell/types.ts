import type * as React from "react";

export type ShellNavItem = {
  href: string;
  label: string;
  /** Icon element, for example `<LayoutDashboard />`. Elements can be passed from Server Components. */
  icon: React.ReactNode;
  /** Shown in the mobile bottom bar (up to four). Other items go under "More". */
  primary?: boolean;
  /** Active only on an exact path match (use for the dashboard root). */
  exact?: boolean;
};

export type ShellOrg = {
  /** From the schema's `settings.org_name` (CORE-01). */
  name: string;
  /** Public URL of the logo from `settings.logo_path`, if any. */
  logoUrl?: string | null;
};

export type ShellUser = {
  displayName: string;
  /** Human-readable role, for example "Registrar". */
  roleLabel: string;
};
