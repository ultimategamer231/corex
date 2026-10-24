import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

/** Page size used by every list (CORE-09). */
export const PAGE_SIZE = 25;

/** Previous / next links with "Page x of y" for server-rendered lists. */
export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  hrefFor,
  className,
}: {
  page: number;
  total: number;
  pageSize?: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link = buttonVariants({ variant: "secondary", size: "sm" });
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-3", className)}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={link}>
          <ChevronLeft aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted">
        Page {page} of {pages}
      </p>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={link}>
          Next
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Page number from a search parameter, clamped to 1 or more. */
export function pageFrom(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
