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
        className="hover:bg-surface-muted inline-flex min-h-11 items-center gap-2 rounded-lg px-1.5 text-left md:pr-2.5"
        aria-label={`Account menu for ${user.displayName}`}
      >
        <span
          aria-hidden="true"
          className="bg-primary-dark inline-flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
        >
          {initials(user.displayName)}
        </span>
        <span className="hidden flex-col leading-tight md:flex" aria-hidden="true">
          <span className="text-ink text-sm font-semibold">{user.displayName}</span>
          <span className="text-muted text-xs">{user.roleLabel}</span>
        </span>
        <ChevronDown className="text-muted hidden size-4 md:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="text-ink block text-sm font-semibold">{user.displayName}</span>
          <span className="text-muted block text-xs">{user.roleLabel}</span>
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
