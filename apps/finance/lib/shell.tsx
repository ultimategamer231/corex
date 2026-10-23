import type { ShellNavItem, ShellOrg, ShellUser } from "@corex/ui/shell";
import {
  ArrowLeftRight,
  FileBarChart,
  FileText,
  Landmark,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

/** Main navigation. Each section's pages are built in Phase 8. */
export const nav: ShellNavItem[] = [
  { href: "/", label: "Overview", icon: <LayoutDashboard />, primary: true, exact: true },
  { href: "/transactions", label: "Transactions", icon: <ArrowLeftRight />, primary: true },
  { href: "/invoices", label: "Invoices", icon: <FileText />, primary: true },
  { href: "/accounts", label: "Accounts", icon: <Landmark />, primary: true },
  { href: "/payroll", label: "Payroll", icon: <Users /> },
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
  return { name: "Sample Trading Ltd", logoUrl: null };
}

/** Signed-in user. Placeholder until Phase 3 adds Supabase Auth and memberships. */
export async function getCurrentUser(): Promise<ShellUser> {
  return { displayName: "Musu Johnson", roleLabel: "Owner" };
}
