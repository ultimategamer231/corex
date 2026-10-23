import type { ShellNavItem, ShellOrg, ShellUser } from "@corex/ui/shell";
import {
  BookOpen,
  CalendarCheck,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

/** Main navigation. Each section's pages are built in Phases 5 and 6. */
export const nav: ShellNavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard />, primary: true, exact: true },
  { href: "/students", label: "Students", icon: <Users />, primary: true },
  { href: "/academics", label: "Academics", icon: <BookOpen />, primary: true },
  { href: "/attendance", label: "Attendance", icon: <CalendarCheck />, primary: true },
  { href: "/grades", label: "Grades", icon: <GraduationCap /> },
  { href: "/fees", label: "Fees", icon: <Wallet /> },
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
  return { name: "Sample College", logoUrl: null };
}

/** Signed-in user. Placeholder until Phase 3 adds Supabase Auth and memberships. */
export async function getCurrentUser(): Promise<ShellUser> {
  return { displayName: "Jartu Kollie", roleLabel: "Registrar" };
}
