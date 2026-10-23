"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../components/sheet";
import { cn } from "../lib/utils";
import { bottomBarItems, isNavItemActive } from "./nav-utils";
import type { ShellNavItem } from "./types";

type BottomNavProps = {
  items: ShellNavItem[];
  pathname: string;
};

const itemClass =
  "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 text-[12px] font-semibold [&_svg]:size-[22px]";

/** Mobile navigation (below md): up to four items plus "More" for the rest. */
export function BottomNav({ items, pathname }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const barItems = bottomBarItems(items);
  const overflow = items.filter((item) => !barItems.includes(item));
  const overflowActive = overflow.some((item) => isNavItemActive(item, pathname));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {barItems.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "text-primary" : "text-muted hover:text-ink")}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        {overflow.length > 0 ? (
          <li className="flex flex-1">
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger
                className={cn(
                  itemClass,
                  overflowActive ? "text-primary" : "text-muted hover:text-ink",
                )}
              >
                <Menu aria-hidden="true" />
                More
              </SheetTrigger>
              <SheetContent side="bottom" className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <SheetTitle>More</SheetTitle>
                <SheetDescription className="sr-only">Other sections of the app</SheetDescription>
                <ul className="flex flex-col">
                  {overflow.map((item) => {
                    const active = isNavItemActive(item, pathname);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex min-h-13 items-center gap-3 rounded-lg px-3 text-base font-semibold [&_svg]:size-5",
                            active
                              ? "bg-tint text-primary-dark"
                              : "text-ink hover:bg-surface-muted",
                          )}
                        >
                          <span aria-hidden="true" className="text-primary">
                            {item.icon}
                          </span>
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
