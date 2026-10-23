import type { ShellNavItem, ShellOrg, ShellUser } from "@corex/ui/shell";
import {
  CalendarDays,
  FileBarChart,
  LayoutDashboard,
  ListOrdered,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

/** Main navigation. Each section's pages are built in Phase 10. */
export const nav: ShellNavItem[] = [
  { href: "/", label: "Today", icon: <LayoutDashboard />, primary: true, exact: true },
  { href: "/patients", label: "Patients", icon: <Users />, primary: true },
  { href: "/appointments", label: "Appointments", icon: <CalendarDays />, primary: true },
  { href: "/queue", label: "Queue", icon: <ListOrdered />, primary: true },
  { href: "/billing", label: "Billing", icon: <Receipt /> },
  { href: "/reports", label: "Reports", icon: <FileBarChart /> },
  { href: "/settings", label: "Settings", icon: <Settings /> },
];

/** Sections other than the dashboard; each has a placeholder page until it is built. */
export const sections = nav.filter((item) => item.href !== "/").map((item) => item.href.slice(1));

/**
 * Organization shown in the top bar. Placeholder until Phase 3 reads it from
 * the schema's `settings` row (CORE-01).
 */
export async function getOrg(): Promise<ShellOrg> {
  return { name: "Sample Medical Center", logoUrl: null };
}

/** Signed-in user. Placeholder until Phase 3 adds Supabase Auth and memberships. */
export async function getCurrentUser(): Promise<ShellUser> {
  return { displayName: "Emmanuel Toe", roleLabel: "Doctor" };
}
