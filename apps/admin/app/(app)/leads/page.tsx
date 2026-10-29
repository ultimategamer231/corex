import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { cn } from "@corex/ui/lib/utils";
import { Download, Inbox, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FollowUp } from "@/components/leads/follow-up";
import { MoveMenu } from "@/components/leads/move-menu";
import { StageBadge } from "@/components/leads/stage-badge";
import { relativeDay } from "@/lib/format";
import {
  leadsQuery,
  parseLeadFilters,
  planLabel,
  PRODUCTS,
  productLabel,
  STAGES,
} from "@/lib/leads";
import { fetchLeads, type LeadRow, stageCounts, teamMembers } from "@/lib/leads-data";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Leads" };

/** The most leads the board shows at once; narrower filters show the rest. */
const BOARD_LIMIT = 300;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LeadsPage({ searchParams }: Props) {
  const filters = parseLeadFilters(await searchParams);
  const page = filters.page ?? 1;
  const board = filters.view === "board";
  const { supabase } = await getAdminSession();
  const [list, counts, team, boardLeads] = await Promise.all([
    fetchLeads(supabase, filters, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
    stageCounts(supabase, filters),
    teamMembers(supabase),
    board
      ? fetchLeads(supabase, filters, { offset: 0, limit: BOARD_LIMIT }, { allStages: true })
      : null,
  ]);
  const names = new Map(team.map((a) => [a.id, a.name]));
  const owner = (id: string | null) => (id ? (names.get(id) ?? "Former admin") : "Unassigned");
  const filtered = Boolean(filters.q || filters.product || filters.assigned);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        description="Quote and contact form requests from the website, plus leads added by hand."
        actions={
          <>
            <a
              href={`/leads/export${leadsQuery(filters, { page: undefined, view: undefined })}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <Download aria-hidden="true" />
              Export CSV
            </a>
            <Link href="/leads/new" className={buttonVariants({ variant: "accent" })}>
              <Plus aria-hidden="true" />
              Add lead
            </Link>
          </>
        }
      />

      <nav aria-label="Stages" className="overflow-x-auto">
        <ul className="flex gap-1 border-b border-border">
          {[["all", "All"] as const, ...STAGES].map(([key, label]) => {
            const active = (filters.stage ?? "all") === key;
            return (
              <li key={key}>
                <Link
                  href={`/leads${leadsQuery(filters, { stage: key === "all" ? undefined : key, page: undefined })}`}
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
                    {counts[key]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <form
          method="get"
          aria-label="Filter leads"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[16rem_14rem_14rem_auto] xl:items-end"
        >
          {filters.stage ? <input type="hidden" name="stage" value={filters.stage} /> : null}
          {filters.view ? <input type="hidden" name="view" value={filters.view} /> : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q">Search leads</Label>
            <Input
              id="q"
              name="q"
              type="search"
              placeholder="Name, organization, phone or email"
              defaultValue={filters.q ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product">Product</Label>
            <Select id="product" name="product" defaultValue={filters.product ?? ""}>
              <option value="">All products</option>
              {PRODUCTS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assigned">Assigned to</Label>
            <Select id="assigned" name="assigned" defaultValue={filters.assigned ?? ""}>
              <option value="">Anyone</option>
              {team
                .filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              <option value="none">Unassigned</option>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={buttonVariants({ variant: "primary" })}>
              Apply
            </button>
            {filtered ? (
              <Link
                href={`/leads${leadsQuery({ stage: filters.stage, view: filters.view })}`}
                className={buttonVariants({ variant: "ghost" })}
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
        <nav aria-label="Layout" className="hidden md:block">
          <ul className="flex rounded-lg border border-border p-1">
            {(
              [
                ["table", "Table"],
                ["board", "Board"],
              ] as const
            ).map(([key, label]) => {
              const active = (filters.view ?? "table") === key;
              return (
                <li key={key}>
                  <Link
                    href={`/leads${leadsQuery(filters, { view: key === "table" ? undefined : key, page: undefined })}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 min-w-20 items-center justify-center rounded-md px-3 font-semibold",
                      active ? "bg-tint text-primary-dark" : "text-ink-soft hover:text-primary",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {list.total === 0 && !board ? (
        <EmptyState
          icon={<Inbox />}
          title={filtered || filters.stage ? "No leads match" : "No leads yet"}
          description={
            filtered || filters.stage
              ? "Try another stage or clear the filters."
              : "Quote requests from the website appear here. You can also add a lead by hand."
          }
        />
      ) : (
        <>
          <ul aria-label="Leads" className="flex flex-col gap-3 md:hidden">
            {list.rows.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} owner={owner(lead.assigned_admin_id)} />
              </li>
            ))}
          </ul>
          {board && boardLeads ? (
            <Board leads={boardLeads.rows} total={boardLeads.total} owner={owner} />
          ) : (
            <div className="hidden md:block">
              <LeadsTable rows={list.rows} owner={owner} />
            </div>
          )}
          <div
            className={cn(
              "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
              board && "md:hidden",
            )}
          >
            <p className="text-[15px] text-muted">
              Showing {list.rows.length} of {list.total} leads
            </p>
            <Pagination
              page={page}
              total={list.total}
              hrefFor={(p) => `/leads${leadsQuery(filters, { page: p })}`}
              className="sm:min-w-80"
            />
          </div>
        </>
      )}
    </div>
  );
}

function LeadsTable({ rows, owner }: { rows: LeadRow[]; owner: (id: string | null) => string }) {
  return (
    <TableScroll label="Leads">
      <Table>
        <thead>
          <tr>
            <Th>Contact</Th>
            <Th>Interested in</Th>
            <Th>Country</Th>
            <Th>Plan</Th>
            <Th>Stage</Th>
            <Th>Assigned to</Th>
            <Th>Follow-up</Th>
            <Th>Received</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr key={lead.id} className="align-top">
              <Td>
                <Link
                  href={`/leads/${lead.id}`}
                  className="inline-flex min-h-11 flex-col justify-center font-semibold text-ink hover:text-primary"
                >
                  {lead.name}
                  <span className="text-sm font-normal text-muted">{lead.organization}</span>
                </Link>
              </Td>
              <Td>{productLabel(lead.product)}</Td>
              <Td>{lead.country ?? "—"}</Td>
              <Td>{planLabel(lead.plan_interest, true)}</Td>
              <Td>
                <StageBadge stage={lead.stage} />
              </Td>
              <Td className={lead.assigned_admin_id ? undefined : "font-semibold text-warning"}>
                {owner(lead.assigned_admin_id)}
              </Td>
              <Td className="whitespace-nowrap">
                <FollowUp day={lead.follow_up_on} />
              </Td>
              <Td className="whitespace-nowrap">{relativeDay(lead.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}

function LeadCard({ lead, owner }: { lead: LeadRow; owner: string }) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 hover:border-primary"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{lead.name}</span>
          <span className="text-sm text-muted">{lead.organization}</span>
        </span>
        <StageBadge stage={lead.stage} />
      </span>
      <span className="text-sm text-ink-soft">
        {productLabel(lead.product)}
        {lead.country ? ` · ${lead.country}` : ""} · Received {relativeDay(lead.created_at)}
      </span>
      <span className="flex flex-wrap justify-between gap-2 text-sm">
        <span className={lead.assigned_admin_id ? "text-ink-soft" : "font-semibold text-warning"}>
          {owner}
        </span>
        {lead.follow_up_on ? (
          <span>
            Follow up <FollowUp day={lead.follow_up_on} />
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function Board({
  leads,
  total,
  owner,
}: {
  leads: LeadRow[];
  total: number;
  owner: (id: string | null) => string;
}) {
  return (
    <div className="hidden flex-col gap-3 md:flex">
      {total > leads.length ? (
        <p className="text-[15px] text-muted">
          Showing the newest {leads.length} of {total} leads. Use the filters to narrow the board.
        </p>
      ) : null}
      <div
        role="region"
        aria-label="Leads board"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard focusable (WCAG 2.1.1)
        tabIndex={0}
        // relative: the buttons' screen-reader text is positioned inside the scroll area,
        // so the board scrolls instead of widening the page.
        className="relative overflow-x-auto pb-2"
      >
        <div className="grid min-w-max auto-cols-[16rem] grid-flow-col gap-4">
          {STAGES.map(([stage, label]) => {
            const column = leads.filter((l) => l.stage === stage);
            return (
              <section
                key={stage}
                aria-labelledby={`board-${stage}`}
                className="flex flex-col gap-3 rounded-xl bg-surface-muted p-3"
              >
                <h2 id={`board-${stage}`} className="flex items-center justify-between font-bold">
                  {label}
                  <span className="rounded-full bg-background px-2 text-xs text-ink-soft">
                    {column.length}
                  </span>
                </h2>
                {column.length === 0 ? (
                  <p className="text-sm text-muted">No leads</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {column.map((lead) => (
                      <li
                        key={lead.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3"
                      >
                        <Link
                          href={`/leads/${lead.id}`}
                          className="flex min-h-11 flex-col font-semibold text-ink hover:text-primary"
                        >
                          {lead.organization}
                          <span className="text-sm font-normal text-muted">
                            {lead.name}
                            {lead.country ? ` · ${lead.country}` : ""}
                          </span>
                        </Link>
                        <span className="text-sm text-ink-soft">{productLabel(lead.product)}</span>
                        <span className="text-sm text-ink-soft">
                          {owner(lead.assigned_admin_id)}
                          {lead.follow_up_on ? (
                            <>
                              {" · "}
                              <FollowUp day={lead.follow_up_on} />
                            </>
                          ) : null}
                        </span>
                        <MoveMenu
                          leadId={lead.id}
                          stage={lead.stage}
                          organization={lead.organization}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
