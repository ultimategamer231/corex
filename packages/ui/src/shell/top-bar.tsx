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
    <header className="border-border-subtle bg-background sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b px-4 md:px-6">
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
            className="bg-primary inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
          >
            {initials(org.name).charAt(0)}
          </span>
        )}
        <p className="font-display text-ink truncate text-base font-bold">{org.name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 md:gap-4">{children}</div>
    </header>
  );
}
