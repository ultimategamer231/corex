import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { cn } from "@corex/ui/lib/utils";
import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientStatusBadge } from "@/components/clients/status-badge";
import { inGroup, money, STATUS_GROUPS, type StatusGroup } from "@/lib/clients";
import { clientSummaries } from "@/lib/clients-data";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Clients" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

export default async function ClientsPage({ searchParams }: Props) {
  const params = await searchParams;
  const group = (STATUS_GROUPS.find(([key]) => key === one(params.status))?.[0] ??
    "all") as StatusGroup;
  const q = one(params.q)?.trim().slice(0, 100);
  const { supabase } = await getAdminSession();
  const all = await clientSummaries(supabase, q);
  const rows = all.filter((c) => inGroup(c.status, group));
  const managed = all.filter((c) => c.plan === "Managed").length;
  const renewals = new Map<string, bigint>();
  for (const c of all) {
    const s = c.subscription;
    if (!s || s.ended_at || c.status === "ended") continue;
    renewals.set(s.currency, (renewals.get(s.currency) ?? 0n) + BigInt(s.renewal_amount_minor));
  }
  const href = (status: StatusGroup) => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (q) p.set("q", q);
    const text = p.toString();
    return `/clients${text ? `?${text}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Organizations with a signed contract, their systems and what they owe."
        actions={
          <Link href="/clients/new" className={buttonVariants({ variant: "accent" })}>
            <Plus aria-hidden="true" />
            Add client
          </Link>
        }
      />

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Clients" value={String(all.length)} />
        <Stat label="Managed plan" value={String(managed)} />
        <Stat
          label="Yearly renewals"
          value={
            renewals.size === 0
              ? "—"
              : [...renewals].map(([currency, total]) => money(total, currency)).join(" · ")
          }
        />
      </dl>

      <nav aria-label="Client status" className="overflow-x-auto">
        <ul className="flex gap-1 border-b border-border">
          {STATUS_GROUPS.map(([key, label]) => {
            const active = key === group;
            return (
              <li key={key}>
                <Link
                  href={href(key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 font-semibold whitespace-nowrap",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-ink-soft hover:text-primary",
                  )}
                >
                  {label}
                  <span className="rounded-full bg-surface-muted px-2 text-xs font-bold text-ink-soft">
                    {all.filter((c) => inGroup(c.status, key)).length}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form
        method="get"
        aria-label="Search clients"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        {group !== "all" ? <input type="hidden" name="status" value={group} /> : null}
        <div className="flex flex-col gap-1.5 sm:w-80">
          <Label htmlFor="q">Search clients</Label>
          <Input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Client name" />
        </div>
        <button type="submit" className={buttonVariants({ variant: "primary" })}>
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title={all.length === 0 && !q ? "No clients yet" : "No clients match"}
          description={
            all.length === 0 && !q
              ? "Convert a won lead from its page, or add a client by hand."
              : "Try another tab or search."
          }
        />
      ) : (
        <>
          <ul aria-label="Clients" className="flex flex-col gap-3 md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 hover:border-primary"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="font-semibold text-ink">{c.name}</span>
                      <span className="text-sm text-muted">{c.place || "—"}</span>
                    </span>
                    <ClientStatusBadge status={c.status} />
                  </span>
                  <span className="text-sm text-ink-soft">
                    {c.product}
                    {c.plan ? ` · ${c.plan}` : ""}
                  </span>
                  <span className="text-sm text-ink-soft">{c.keyDate}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <TableScroll label="Clients">
              <Table>
                <thead>
                  <tr>
                    <Th>Client</Th>
                    <Th>System</Th>
                    <Th>Plan</Th>
                    <Th>Status</Th>
                    <Th>Key date</Th>
                    <Th>Client since</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="align-top">
                      <Td>
                        <Link
                          href={`/clients/${c.id}`}
                          className="inline-flex min-h-11 flex-col justify-center font-semibold text-ink hover:text-primary"
                        >
                          {c.name}
                          <span className="text-sm font-normal text-muted">{c.place || "—"}</span>
                        </Link>
                      </Td>
                      <Td>{c.product}</Td>
                      <Td>{c.plan ?? "—"}</Td>
                      <Td>
                        <ClientStatusBadge status={c.status} />
                      </Td>
                      <Td className="whitespace-nowrap">{c.keyDate}</Td>
                      <Td className="whitespace-nowrap">{c.since}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold text-ink">{value}</dd>
    </div>
  );
}
