"use client";

import { cn } from "@corex/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section tabs as links; the current one is marked for screen readers. */
export function SubNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto">
      <ul className="flex gap-1 border-b border-border">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== items[0]?.href && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 min-w-11 items-center border-b-2 px-3 font-semibold whitespace-nowrap",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-ink-soft hover:text-primary",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
