import { Badge } from "@corex/ui/components/badge";
import { Button, buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { date, money, todayIso } from "@/lib/format";
import { loadAccounts, loadCategories } from "@/lib/finance";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { lastTwelveMonths, periodFrom } from "@/lib/period";
import { rows } from "@/lib/queries";
import { MANAGER, RECORDERS } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";

export const metadata: Metadata = { title: "Transactions" };

const TYPES = { income: "Income", expense: "Expense", transfer: "Transfer" } as const;

type Props = {
  searchParams: Promise<{
    type?: string;
    account?: string;
    category?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

export default async function TransactionsPage({ searchParams }: Props) {
  const { supabase, member } = await requireRoles(RECORDERS);
  const manager = memberHas(member, MANAGER);
  const settings = await getSettings();
  const params = await searchParams;
  const period = periodFrom(params, lastTwelveMonths(todayIso(settings.timezone)));
  const type = (Object.keys(TYPES) as (keyof typeof TYPES)[]).find((t) => t === params.type);
  const account = isUuid(params.account) ? params.account : undefined;
  const category = isUuid(params.category) ? params.category : undefined;
  const page = pageFrom(params.page);

  let query = supabase
    .from("transactions")
    .select(
      "id, type, date, amount_minor, currency, memo, status, reversal_of_id, account_id, to_account_id, categories(name), counterparties(name)",
      { count: "exact" },
    )
    .gte("date", period.from)
    .lte("date", period.to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type) query = query.eq("type", type);
  if (account) query = query.or(`account_id.eq.${account},to_account_id.eq.${account}`);
  if (category) query = query.eq("category_id", category);
  const [result, accounts, categories] = await Promise.all([
    query,
    loadAccounts(supabase),
    loadCategories(supabase),
  ]);
  const entries = rows(result);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const filters = {
    ...(type ? { type } : {}),
    ...(account ? { account } : {}),
    ...(category ? { category } : {}),
    from: period.from,
    to: period.to,
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        description={
          manager ? "Money in, money out and transfers." : "The entries you have recorded."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className={buttonVariants({ variant: "accent" })}
              href="/transactions/new?type=income"
            >
              Record income
            </Link>
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href="/transactions/new?type=expense"
            >
              Record expense
            </Link>
            {manager ? (
              <Link
                className={buttonVariants({ variant: "secondary" })}
                href="/transactions/new?type=transfer"
              >
                Transfer
              </Link>
            ) : null}
          </div>
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-3" aria-label="Filter transactions">
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue={type ?? ""}>
            <option value="">All types</option>
            {Object.entries(TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-56 max-w-full flex-col gap-1.5">
          <Label htmlFor="account">Account</Label>
          <Select id="account" name="account" defaultValue={account ?? ""}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-56 max-w-full flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue={category ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={period.from} />
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={period.to} />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight />}
          title="No transactions"
          description="Nothing matches these filters. Record income or an expense to start."
        />
      ) : (
        <>
          <TableScroll label="Transactions">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Details</Th>
                  <Th>Account</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((t) => {
                  const what =
                    t.type === "transfer"
                      ? `Transfer to ${accountName.get(t.to_account_id ?? "") ?? ""}`
                      : [t.categories?.name, t.counterparties?.name].filter(Boolean).join(", ");
                  const sign = t.type === "income" ? "" : t.type === "expense" ? "−" : "";
                  return (
                    <tr key={t.id}>
                      <Td className="whitespace-nowrap">{date(t.date, settings.timezone)}</Td>
                      <Td>
                        <Link
                          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                          href={`/transactions/${t.id}`}
                        >
                          {what || TYPES[t.type as keyof typeof TYPES]}
                        </Link>
                        {t.reversal_of_id ? (
                          <Badge variant="warning" className="ml-2">
                            Reversal
                          </Badge>
                        ) : t.status === "void" ? (
                          <Badge variant="danger" className="ml-2">
                            Void
                          </Badge>
                        ) : null}
                        {t.memo ? <p className="text-sm text-muted">{t.memo}</p> : null}
                      </Td>
                      <Td>{accountName.get(t.account_id)}</Td>
                      <Td className="text-right whitespace-nowrap">
                        <span className="sr-only">{TYPES[t.type as keyof typeof TYPES]} </span>
                        {sign}
                        {money(t.amount_minor, t.currency)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
          <Pagination
            page={page}
            total={result.count ?? 0}
            hrefFor={(p) =>
              `/transactions?${new URLSearchParams({ ...filters, page: String(p) }).toString()}`
            }
          />
        </>
      )}
    </>
  );
}
