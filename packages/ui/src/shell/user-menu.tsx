"use client";

import { ChevronDown, LogOut } from "lucide-react";
import type * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { initials } from "./nav-utils";
import type { ShellUser } from "./types";

type UserMenuProps = {
  user: ShellUser;
  /** Extra menu items (for example "Change password"). */
  children?: React.ReactNode;
  /** Sign-out handler, typically a Server Action. Hidden when not provided. */
  onSignOut?: () => void | Promise<void>;
};

export function UserMenu({ user, children, onSignOut }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-surface-muted md:pr-2.5"
        aria-label={`Account menu for ${user.displayName}`}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full bg-primary-dark text-xs font-bold text-white"
        >
          {initials(user.displayName)}
        </span>
        <span className="hidden flex-col leading-tight md:flex" aria-hidden="true">
          <span className="text-sm font-semibold text-ink">{user.displayName}</span>
          <span className="text-xs text-muted">{user.roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted md:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold text-ink">{user.displayName}</span>
          <span className="block text-xs text-muted">{user.roleLabel}</span>
        </DropdownMenuLabel>
        {children}
        {onSignOut ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void onSignOut()}>
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
