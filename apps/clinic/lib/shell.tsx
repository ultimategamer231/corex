import type { ShellNavItem } from "@corex/ui/shell";
import {
  CalendarDays,
  FileBarChart,
  LayoutDashboard,
  ListOrdered,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { ADMIN, BILLING, FRONT_DESK, hasAnyRole, REPORTS, type Role } from "./roles";

type Item = ShellNavItem & { roles?: readonly Role[] };

const ITEMS: Item[] = [
  { href: "/", label: "Today", icon: <LayoutDashboard />, primary: true, exact: true },
  { href: "/patients", group: "Front desk", label: "Patients", icon: <Users />, primary: true },
  {
    href: "/appointments",
    group: "Front desk",
    label: "Appointments",
    icon: <CalendarDays />,
    primary: true,
  },
  {
    href: "/queue",
    group: "Front desk",
    label: "Queue",
    icon: <ListOrdered />,
    primary: true,
    roles: FRONT_DESK,
  },
  {
    href: "/billing",
    group: "Money",
    label: "Billing",
    icon: <Receipt />,
    primary: true,
    roles: BILLING,
  },
  { href: "/reports", group: "Money", label: "Reports", icon: <FileBarChart />, roles: REPORTS },
  { href: "/settings", group: "Clinic", label: "Settings", icon: <Settings />, roles: ADMIN },
];

/** Navigation for the member's roles (SPEC.md 8.1, 8.4); at most four in the bottom bar. */
export function navFor(roles: readonly string[]): ShellNavItem[] {
  let primary = 0;
  return ITEMS.filter((i) => !i.roles || hasAnyRole(roles, i.roles)).map(
    ({ roles: _r, ...item }) => {
      if (!item.primary) return item;
      primary += 1;
      return primary <= 4 ? item : { ...item, primary: false };
    },
  );
}
