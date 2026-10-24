import type { ShellNavItem } from "@corex/ui/shell";
import {
  ArrowLeftRight,
  BookUser,
  FileBarChart,
  FileText,
  Landmark,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { hasAnyRole, MANAGER, type Role } from "./roles";

type Item = ShellNavItem & { roles?: readonly Role[] };

const ITEMS: Item[] = [
  { href: "/", label: "Overview", icon: <LayoutDashboard />, primary: true, exact: true },
  { href: "/transactions", label: "Transactions", icon: <ArrowLeftRight />, primary: true },
  { href: "/invoices", label: "Invoices", icon: <FileText />, primary: true, roles: MANAGER },
  { href: "/accounts", label: "Accounts", icon: <Landmark />, primary: true, roles: MANAGER },
  { href: "/counterparties", label: "Customers and vendors", icon: <BookUser /> },
  { href: "/payroll", label: "Payroll", icon: <Users />, roles: MANAGER },
  { href: "/reports", label: "Reports", icon: <FileBarChart />, roles: MANAGER },
  { href: "/settings", label: "Settings", icon: <Settings />, roles: MANAGER },
];

/** Navigation for the member's roles (SPEC.md 9.1, 9.4); Staff see only what they use. */
export function navFor(roles: readonly string[]): ShellNavItem[] {
  const items = ITEMS.filter((i) => !i.roles || hasAnyRole(roles, i.roles));
  // Staff have no invoices or accounts, so their customer list joins the bottom bar.
  const primaryCount = items.filter((i) => i.primary).length;
  return items.map(({ roles: _roles, ...item }) =>
    item.href === "/counterparties" && primaryCount < 4 ? { ...item, primary: true } : item,
  );
}
