import type { ShellNavItem } from "./types";

/** True when `item` matches the current path. Prefix matches stop at a path segment. */
export function isNavItemActive(item: Pick<ShellNavItem, "href" | "exact">, pathname: string) {
  if (item.exact || item.href === "/") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Up to four items for the mobile bottom bar: those marked `primary`, else the first four. */
export function bottomBarItems(items: ShellNavItem[]): ShellNavItem[] {
  const primary = items.filter((item) => item.primary);
  return (primary.length > 0 ? primary : items).slice(0, 4);
}

/** Initials for an avatar: first letters of the first two words. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase());
  return letters.join("") || "?";
}
