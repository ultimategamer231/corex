"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "../lib/utils";
import { isNavItemActive } from "./nav-utils";
import type { ShellNavItem } from "./types";

type SidebarNavProps = {
  items: ShellNavItem[];
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

/** Desktop sidebar (md and up). Collapses to an icon rail; labels stay available to screen readers. */
export function SidebarNav({ items, pathname, collapsed, onToggleCollapsed }: SidebarNavProps) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "dark-surface bg-primary-dark sticky top-0 hidden h-dvh shrink-0 flex-col md:flex",
        collapsed ? "w-[76px]" : "w-60",
      )}
    >
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-4">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors duration-150",
                    "[&_svg]:size-5 [&_svg]:shrink-0",
                    active
                      ? "bg-primary text-white shadow-[inset_3px_0_0_var(--color-accent)]"
                      : "text-on-dark-muted hover:bg-white/10 hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className={cn(
            "text-on-dark-muted flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-white/10 hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-5" aria-hidden="true" />
          )}
          <span className={cn(collapsed && "sr-only")}>
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </button>
      </div>
    </aside>
  );
}
