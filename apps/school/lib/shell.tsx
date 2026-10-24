import type { ShellNavItem } from "@corex/ui/shell";
import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import type { Edition } from "./env";
import { BURSAR, hasAnyRole, OFFICE, REGISTRAR, type Role, TEACHING } from "./roles";

type NavEntry = ShellNavItem & { roles: readonly Role[] | "all"; editions?: readonly Edition[] };

const ENTRIES: NavEntry[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard />, exact: true, roles: "all" },
  { href: "/students", label: "Students", icon: <Users />, roles: OFFICE },
  {
    href: "/planning",
    label: "Course planning",
    icon: <ListChecks />,
    roles: ["student"],
    editions: ["college"],
  },
  {
    href: "/registration",
    label: "Registration",
    icon: <ClipboardCheck />,
    roles: REGISTRAR,
    editions: ["college"],
  },
  { href: "/academics", label: "Academics", icon: <BookOpen />, roles: REGISTRAR },
  {
    href: "/attendance",
    label: "Attendance",
    icon: <CalendarCheck />,
    roles: [...REGISTRAR, ...TEACHING],
  },
  {
    href: "/grades",
    label: "Grades",
    icon: <GraduationCap />,
    roles: [...REGISTRAR, ...TEACHING, "student"],
  },
  { href: "/fees", label: "Fees", icon: <Wallet />, roles: [...BURSAR, "student"] },
  { href: "/reports", label: "Reports", icon: <FileBarChart />, roles: [...OFFICE, "student"] },
  { href: "/announcements", label: "Announcements", icon: <Megaphone />, roles: "all" },
  { href: "/settings", label: "Settings", icon: <Settings />, roles: ["super_admin"] },
];

/** Navigation for the member's roles; the first four are in the mobile bottom bar. */
export function navFor(roles: readonly string[], edition: Edition): ShellNavItem[] {
  return ENTRIES.filter(
    (e) =>
      (e.roles === "all" || hasAnyRole(roles, e.roles)) &&
      (!e.editions || e.editions.includes(edition)),
  ).map(({ roles: _roles, editions: _editions, ...item }, i) => ({ ...item, primary: i < 4 }));
}

export const allNavHrefs = ENTRIES.map((e) => e.href);
