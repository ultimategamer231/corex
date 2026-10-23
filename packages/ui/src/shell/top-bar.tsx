import Image from "next/image";
import type * as React from "react";
import { initials } from "./nav-utils";
import type { ShellOrg } from "./types";

type TopBarProps = {
  org: ShellOrg;
  /** Right-hand content: status badge, user menu. */
  children?: React.ReactNode;
};

/** Top bar with the organization's name and logo (both from settings, CORE-01). */
export function TopBar({ org, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border-subtle bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        {org.logoUrl ? (
          <Image
            src={org.logoUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="size-8 shrink-0 rounded-md object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-white"
          >
            {initials(org.name).charAt(0)}
          </span>
        )}
        <p className="truncate font-display text-base font-bold text-ink">{org.name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 md:gap-4">{children}</div>
    </header>
  );
}
