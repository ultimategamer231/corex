import Link from "next/link";
import { breadcrumbSchema } from "@/lib/structured-data";
import { JsonLd } from "./json-ld";

export function Breadcrumb({
  items,
  tone = "light",
}: {
  items: { label: string; href?: string }[];
  /** "dark" on the dark hero panels. */
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <>
      <JsonLd data={breadcrumbSchema(items)} />
      <nav aria-label="Breadcrumb" className={dark ? "text-sm text-on-dark" : "text-sm text-muted"}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, i) => (
            <li key={item.label} className="flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className={`inline-flex min-h-11 min-w-11 items-center font-semibold hover:underline ${dark ? "text-white" : "text-primary"}`}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className={dark ? "font-semibold text-white" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
