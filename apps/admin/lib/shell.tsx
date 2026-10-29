import type { ShellNavItem } from "@corex/ui/shell";
import {
  FileText,
  History,
  LayoutDashboard,
  Building2,
  RefreshCw,
  Settings,
  UserPlus,
} from "lucide-react";

/** Navigation from Sidebar.dc.html (SPEC-ADMIN.md 6). */
export const NAV: ShellNavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard />, primary: true, exact: true },
  { href: "/leads", label: "Leads", icon: <UserPlus />, primary: true },
  { href: "/clients", label: "Clients", icon: <Building2 />, primary: true },
  { href: "/subscriptions", label: "Subscriptions", icon: <RefreshCw /> },
  { href: "/invoices", label: "Invoices and receipts", icon: <FileText />, primary: true },
  { href: "/settings/team", label: "Settings", icon: <Settings /> },
  { href: "/activity", label: "Activity log", icon: <History /> },
];
