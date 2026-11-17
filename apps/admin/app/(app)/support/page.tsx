import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { cn } from "@corex/ui/lib/utils";
import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddSupportDialog, type SupportItem, SupportTable } from "@/components/support-list";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Support" };

type Props = { searchParams: Promise<{ show?: string }> };

/**
 * Support log (audit round A5): each client's issues, requests and questions with their
 * status. Open items first; resolved items stay as a record.
 */
export default async function SupportPage({ searchParams }: Props) {
  const { supabase } = await getAdminSession();
  const all = (await searchParams).show === "all";
  let query = supabase
    .from("support_tickets")
    .select(
      "id, client_id, opened_on, kind, priority, title, details, status, resolved_on, resolution",
    )
    .order("status")
    .order("opened_on", { ascending: false })
    .limit(300);
  if (!all) query = query.neq("status", "resolved");
  const [items, clients] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (items.error) throw new Error(items.error.message);
  const rows = (items.data ?? []) as SupportItem[];
  const names = new Map((clients.data ?? []).map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        title="Support"
        description="Issues, requests and questions from clients. Useful proof when you offer a paid support plan."
        actions={<AddSupportDialog clients={clients.data ?? []} />}
      />
      <nav aria-label="Show" className="mb-6 flex gap-2">
        {[
          { href: "/support", label: "Open", current: !all },
          { href: "/support?show=all", label: "All, with resolved", current: all },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold",
              t.current
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-primary hover:border-primary",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy />}
          title={all ? "No support items yet" : "Nothing open"}
          description="Add an item when a client reports an issue or asks for something."
        />
      ) : (
        <SupportTable items={rows} clients={names} label="Support items" />
      )}
    </>
  );
}
