import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Download, History, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  actorLabel,
  areaLabel,
  AREAS,
  changeLines,
  fetchActivity,
  filtersQuery,
  parseFilters,
} from "@/lib/activity";
import { formatDateTime } from "@/lib/format";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 25;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ActivityPage({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  const page = filters.page ?? 1;
  const { supabase } = await getAdminSession();
  const [{ rows, total }, { data: admins }] = await Promise.all([
    fetchActivity(supabase, filters, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
    supabase.from("admins").select("user_id, name").order("name"),
  ]);
  const names = new Map((admins ?? []).map((a) => [a.user_id, a.name]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity log"
        description="Every change made in the admin, by whom and when."
        actions={
          <a
            href={`/activity/export${filtersQuery(filters, { page: undefined })}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Download aria-hidden="true" />
            Export CSV
          </a>
        }
      />
      <p className="flex items-start gap-3 rounded-lg border border-border bg-tint px-4 py-3 text-[15px] text-primary-dark">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        This log is permanent. No admin can edit or delete an entry, and the database rejects any
        attempt to change one. Corrections appear as new entries.
      </p>

      <form
        method="get"
        aria-label="Filter the activity log"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] xl:items-end"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" type="search" defaultValue={filters.q ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin">Admin</Label>
          <Select id="admin" name="admin" defaultValue={filters.admin ?? ""}>
            <option value="">Everyone</option>
            {(admins ?? []).map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.name}
              </option>
            ))}
            <option value="system">System</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area">Area</Label>
          <Select id="area" name="area" defaultValue={filters.area ?? ""}>
            <option value="">All areas</option>
            {AREAS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
        </div>
        <button type="submit" className={buttonVariants({ variant: "primary" })}>
          Apply
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No entries"
          description="Nothing matches these filters."
        />
      ) : (
        <TableScroll label="Activity log entries">
          <Table>
            <thead>
              <tr>
                <Th className="w-40">When (GMT)</Th>
                <Th className="w-40">Admin</Th>
                <Th className="w-32">Area</Th>
                <Th>What happened</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const changes = changeLines(r);
                return (
                  <tr key={r.seq} className="align-top">
                    <Td className="whitespace-nowrap">{formatDateTime(r.created_at)}</Td>
                    <Td>
                      {r.actor_id
                        ? (names.get(r.actor_id) ?? "Former admin")
                        : actorLabel(r.actor_type)}
                    </Td>
                    <Td>
                      <Badge variant="neutral">{areaLabel(r.area)}</Badge>
                    </Td>
                    <Td>
                      <details>
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                          <span>{r.summary}</span>
                          <span className="text-sm font-semibold whitespace-nowrap text-primary">
                            Details
                          </span>
                        </summary>
                        <div className="mt-1 mb-2 flex flex-col gap-1 rounded-md bg-surface px-3 py-2 text-sm text-ink-soft">
                          <p>
                            Entry {r.seq} · {r.table_name}
                            {r.record_id ? ` ${r.record_id}` : ""}
                          </p>
                          {r.reason ? <p>Reason: {r.reason}</p> : null}
                          {changes.length > 0 ? (
                            <ul className="list-disc pl-5">
                              {changes.map((line) => (
                                <li key={line} className="break-all">
                                  {line}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {r.ip || r.user_agent ? (
                            <p className="break-all">
                              {r.ip ? `IP ${r.ip}` : ""}
                              {r.ip && r.user_agent ? " · " : ""}
                              {r.user_agent ?? ""}
                            </p>
                          ) : null}
                        </div>
                      </details>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      )}

      <nav
        aria-label="Activity log pages"
        className="flex flex-wrap items-center justify-between gap-3 text-[15px] text-muted"
      >
        <span>
          Showing {rows.length} of {total} entries
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/activity${filtersQuery(filters, { page: page - 1 })}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              href={`/activity${filtersQuery(filters, { page: page + 1 })}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Next
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
