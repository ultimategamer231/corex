import type { ShellNavItem } from "@corex/ui/shell";
import {
  ArrowUpRight,
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
  { href: "/students", group: "People", label: "Students", icon: <Users />, roles: OFFICE },
  {
    href: "/planning",
    group: "People",
    label: "Course planning",
    icon: <ListChecks />,
    roles: ["student"],
    editions: ["college"],
  },
  {
    href: "/registration",
    group: "People",
    label: "Registration",
    icon: <ClipboardCheck />,
    roles: REGISTRAR,
    editions: ["college"],
  },
  {
    href: "/academics",
    group: "Teaching",
    label: "Academics",
    icon: <BookOpen />,
    roles: REGISTRAR,
  },
  {
    href: "/promotions",
    group: "Teaching",
    label: "Promotions",
    icon: <ArrowUpRight />,
    roles: REGISTRAR,
    editions: ["highschool"],
  },
  {
    href: "/attendance",
    group: "Teaching",
    label: "Attendance",
    icon: <CalendarCheck />,
    roles: [...REGISTRAR, ...TEACHING],
  },
  {
    href: "/grades",
    group: "Teaching",
    label: "Grades",
    icon: <GraduationCap />,
    roles: [...REGISTRAR, ...TEACHING, "student", "parent"],
  },
  {
    href: "/fees",
    group: "Money",
    label: "Fees",
    icon: <Wallet />,
    roles: [...BURSAR, "student", "parent"],
  },
  {
    href: "/reports",
    group: "Money",
    label: "Reports",
    icon: <FileBarChart />,
    roles: [...OFFICE, "student", "parent"],
  },
  {
    href: "/announcements",
    group: "School",
    label: "Announcements",
    icon: <Megaphone />,
    roles: "all",
  },
  {
    href: "/settings",
    group: "School",
    label: "Settings",
    icon: <Settings />,
    roles: ["super_admin"],
  },
];

/** Navigation for the member's roles; the first four are in the mobile bottom bar. */
export function navFor(roles: readonly string[], edition: Edition): ShellNavItem[] {
  return ENTRIES.filter(
    (e) =>
      (e.roles === "all" || hasAnyRole(roles, e.roles)) &&
      (!e.editions || e.editions.includes(edition)),
  ).map(({ roles: _roles, editions: _editions, ...item }, i, all) => ({
    ...item,
    // Short menus (students, parents, teachers) stay a plain list.
    group: all.length > 6 ? item.group : undefined,
    primary: i < 4,
  }));
}

export const allNavHrefs = ENTRIES.map((e) => e.href);
