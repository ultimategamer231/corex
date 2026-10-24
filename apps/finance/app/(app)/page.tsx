import { buttonVariants } from "@corex/ui/components/button";
import { PageHeader } from "@corex/ui/components/page-header";
import { Stat } from "@corex/ui/components/stat";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import Link from "next/link";
import { CategoryChart, IncomeExpenseChart } from "@/components/charts";
import { Section } from "@/components/section";
import { ACCOUNT_TYPES, loadAccounts, loadCategories, loadCounterparties } from "@/lib/finance";
import { date, money, todayIso } from "@/lib/format";
import { baseIncomeExpense, monthOf, monthsBetween } from "@/lib/ledger";
import { getSettings } from "@/lib/org";
import { lastTwelveMonths } from "@/lib/period";
import { rows } from "@/lib/queries";
import { entriesIn } from "@/lib/reports";
import { MANAGER } from "@/lib/roles";
import { getSession, memberHas, type Session } from "@/lib/session";

export default async function OverviewPage() {
  const session = await getSession();
  return (
    <>
      <PageHeader title="Overview" description={`Welcome, ${session.member.displayName}.`} />
      {memberHas(session.member, MANAGER) ? (
        <ManagerOverview session={session} />
      ) : (
        <StaffOverview session={session} />
      )}
    </>
  );
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

async function ManagerOverview({ session }: { session: Session }) {
  const { supabase } = session;
  const settings = await getSettings();
  const base = settings.baseCurrency;
  const today = todayIso(settings.timezone);
  const period = lastTwelveMonths(today);
  const [accounts, entries, categories, counterparties, overdue] = await Promise.all([
    loadAccounts(supabase),
    entriesIn(supabase, period),
    loadCategories(supabase),
    loadCounterparties(supabase),
    supabase
      .from("invoices")
      .select("id, number, party_id, currency, due_date, status")
      .in("status", ["issued", "partially_paid"])
      .lt("due_date", today)
      .order("due_date")
      .limit(5)
      .then(rows),
  ]);
  const overdueIds = overdue.map((i) => i.id);
  const balances = overdueIds.length
    ? rows(
        await supabase
          .from("invoice_balances")
          .select("invoice_id, total_minor, paid_minor")
          .in("invoice_id", overdueIds),
      )
    : [];
  const due = new Map(
    balances.map((b) => [b.invoice_id, Number(b.total_minor) - Number(b.paid_minor)]),
  );

  const months = new Map(
    monthsBetween(period.from, period.to).map((m) => [m, { income: 0, expense: 0 }]),
  );
  const byCategory = new Map<string, number>();
  const byCustomer = new Map<string, number>();
  for (const e of entries) {
    const { income, expense } = baseIncomeExpense(e);
    const m = months.get(monthOf(e.date));
    if (m) {
      m.income += income;
      m.expense += expense;
    }
    if (expense && e.category_id)
      byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + expense);
    if (income && e.counterparty_id)
      byCustomer.set(e.counterparty_id, (byCustomer.get(e.counterparty_id) ?? 0) + income);
  }
  const names = new Map([...categories, ...counterparties].map((x) => [x.id, x.name]));
  const ranked = [...byCategory.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const topCategories = ranked.slice(0, 6);
  const otherCategories = ranked.slice(6).reduce((s, [, v]) => s + v, 0);
  const topCustomers = [...byCustomer.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totals = [...months.values()].reduce(
    (t, m) => ({ income: t.income + m.income, expense: t.expense + m.expense }),
    { income: 0, expense: 0 },
  );
  const monthBars = [...months.entries()].map(([key, m]) => {
    const d = new Date(`${key}-01T00:00:00Z`);
    return {
      label: MONTH_YEAR.format(d),
      short: MONTH.format(d),
      income: m.income,
      expense: m.expense,
      incomeText: money(m.income, base),
      expenseText: money(m.expense, base),
    };
  });

  return (
    <div className="flex flex-col gap-10">
      <Section title="Balances" id="balances">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts
            .filter((a) => a.active)
            .map((a) => (
              <Stat
                key={a.id}
                label={a.name}
                value={money(a.balance_minor, a.currency)}
                detail={ACCOUNT_TYPES[a.type]}
              />
            ))}
        </div>
      </Section>

      <Section
        title="Income and expenses"
        id="income-expenses"
        description={`Last 12 months, cash basis. Income ${money(totals.income, base)}, expenses ${money(totals.expense, base)}.`}
        actions={
          <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/reports">
            Open reports
          </Link>
        }
      >
        <div className="rounded-xl border border-border bg-background p-5">
          <IncomeExpenseChart months={monthBars} currency={base} />
          <details className="mt-4">
            <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
              Show as a table
            </summary>
            <TableScroll label="Income and expenses per month">
              <Table>
                <thead>
                  <tr>
                    <Th>Month</Th>
                    <Th className="text-right">Income</Th>
                    <Th className="text-right">Expenses</Th>
                  </tr>
                </thead>
                <tbody>
                  {monthBars.map((m) => (
                    <tr key={m.label}>
                      <Td>{m.label}</Td>
                      <Td className="text-right whitespace-nowrap">{m.incomeText}</Td>
                      <Td className="text-right whitespace-nowrap">{m.expenseText}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          </details>
        </div>
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Expenses by category" id="categories" description="Last 12 months">
          <div className="rounded-xl border border-border bg-background p-5">
            {ranked.length === 0 ? (
              <p className="text-muted">No expenses yet.</p>
            ) : (
              <CategoryChart
                label="Expenses by category"
                items={[
                  ...topCategories.map(([id, v]) => ({
                    label: names.get(id) ?? "",
                    value: v,
                    valueText: money(v, base),
                  })),
                  ...(otherCategories > 0
                    ? [
                        {
                          label: "Other",
                          value: otherCategories,
                          valueText: money(otherCategories, base),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        </Section>

        <Section title="Top customers" id="customers" description="Income received, last 12 months">
          {topCustomers.length === 0 ? (
            <p className="text-muted">No income from customers yet.</p>
          ) : (
            <TableScroll label="Top customers">
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th className="text-right">Received</Th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map(([id, v]) => (
                    <tr key={id}>
                      <Td className="font-semibold">{names.get(id)}</Td>
                      <Td className="text-right whitespace-nowrap">{money(v, base)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
      </div>

      <Section title="Overdue invoices" id="overdue">
        {overdue.length === 0 ? (
          <p className="text-muted">No invoices are overdue.</p>
        ) : (
          <TableScroll label="Overdue invoices">
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <Link
                        className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                        href={`/invoices/${i.id}`}
                      >
                        No. {i.number}
                      </Link>
                    </Td>
                    <Td>{names.get(i.party_id)}</Td>
                    <Td className="whitespace-nowrap">{date(i.due_date, settings.timezone)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {money(due.get(i.id) ?? 0, i.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Section>
    </div>
  );
}

async function StaffOverview({ session }: { session: Session }) {
  const { supabase } = session;
  const settings = await getSettings();
  const recent = rows(
    await supabase
      .from("transactions")
      .select("id, type, date, amount_minor, currency, categories(name)")
      .is("reversal_of_id", null)
      .order("created_at", { ascending: false })
      .limit(5),
  );
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap gap-3">
        <Link
          className={buttonVariants({ variant: "accent", size: "lg" })}
          href="/transactions/new?type=income"
        >
          Record income
        </Link>
        <Link
          className={buttonVariants({ variant: "secondary", size: "lg" })}
          href="/transactions/new?type=expense"
        >
          Record an expense
        </Link>
      </div>
      <Section title="Your recent entries" id="recent">
        {recent.length === 0 ? (
          <p className="text-muted">You have not recorded anything yet.</p>
        ) : (
          <TableScroll label="Your recent entries">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <Td className="whitespace-nowrap">{date(t.date, settings.timezone)}</Td>
                    <Td>
                      <Link
                        className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                        href={`/transactions/${t.id}`}
                      >
                        {t.categories?.name ?? t.type}
                      </Link>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {t.type === "expense" ? "−" : ""}
                      {money(t.amount_minor, t.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Section>
    </div>
  );
}
