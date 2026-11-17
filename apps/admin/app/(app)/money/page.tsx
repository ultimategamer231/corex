import { Card, CardContent, CardHeader, CardTitle } from "@corex/ui/components/card";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { cn } from "@corex/ui/lib/utils";
import { PiggyBank, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { removeExpense, saveExpense } from "./actions";
import { FormField } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { FormDialog } from "@/components/form-dialog";
import { money } from "@/lib/clients";
import { formatDay, todayIso } from "@/lib/format";
import { majorText } from "@/lib/invoices";
import {
  breakdown,
  type CurrencyReport,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  MONTHS,
  type MoneyReport,
  PRODUCT_NAMES,
  reportYear,
  yearTotals,
} from "@/lib/money-report";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Money report" };

type Props = { searchParams: Promise<{ year?: string }> };

type Expense = {
  id: string;
  spent_on: string;
  category: string;
  description: string;
  amount_minor: number;
  currency: string;
  client_id: string | null;
};

/**
 * Money report (audit round A4): what came in, what Corex spent and what is left, by
 * month, per currency (never added together), with income by product and expenses by
 * category, and the year's expenses.
 */
export default async function MoneyPage({ searchParams }: Props) {
  const { supabase } = await getAdminSession();
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const year = reportYear((await searchParams).year, thisYear);
  const [report, expenses, clients] = await Promise.all([
    supabase.rpc("money_report", { p_year: year }),
    supabase
      .from("expenses")
      .select("id, spent_on, category, description, amount_minor, currency, client_id")
      .gte("spent_on", `${year}-01-01`)
      .lte("spent_on", `${year}-12-31`)
      .order("spent_on", { ascending: false })
      .limit(500),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (report.error) throw new Error(report.error.message);
  if (expenses.error) throw new Error(expenses.error.message);
  const data = report.data as unknown as MoneyReport;
  const currencies = Object.entries(data.currencies).sort(([a], [b]) =>
    a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b),
  );
  const clientNames = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const years = [thisYear, thisYear - 1].filter((y) => y >= 2024);

  return (
    <>
      <PageHeader
        title="Money report"
        description={`Payments received, your own expenses and what is left in ${year}. Each currency is shown on its own.`}
        actions={
          <ExpenseDialog
            clients={clients.data ?? []}
            today={today}
            triggerLabel="Add expense"
            title="Add an expense"
          />
        }
      />
      <nav aria-label="Year" className="mb-6 flex gap-2">
        {years.map((y) => (
          <Link
            key={y}
            href={y === thisYear ? "/money" : `/money?year=${y}`}
            aria-current={y === year ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold",
              y === year
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-primary hover:border-primary",
            )}
          >
            {y}
          </Link>
        ))}
      </nav>

      {currencies.length === 0 ? (
        <EmptyState
          icon={<PiggyBank />}
          title={`Nothing recorded in ${year}`}
          description="Payments you record on invoices and the expenses you add here appear in this report."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {currencies.map(([currency, r]) => (
            <CurrencySection key={currency} currency={currency} year={year} report={r} />
          ))}
        </div>
      )}

      <section aria-labelledby="expenses-h" className="mt-8 flex flex-col gap-4">
        <h2 id="expenses-h" className="font-display text-xl font-bold text-ink">
          Expenses in {year}
        </h2>
        {(expenses.data ?? []).length === 0 ? (
          <p className="text-ink-soft">
            No expenses yet. Add hosting, domains, software and other costs to see what is left.
          </p>
        ) : (
          <TableScroll label={`List of expenses in ${year}`}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>What for</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {(expenses.data as Expense[]).map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap">{formatDay(e.spent_on)}</Td>
                    <Td>
                      {e.description}
                      {e.client_id && clientNames.get(e.client_id) ? (
                        <span className="block text-sm text-ink-soft">
                          For {clientNames.get(e.client_id)}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{EXPENSE_CATEGORIES[e.category as ExpenseCategory] ?? e.category}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {money(e.amount_minor, e.currency)}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <ExpenseDialog
                          clients={clients.data ?? []}
                          today={today}
                          expense={e}
                          triggerLabel={`Edit ${e.description}`}
                          title="Edit expense"
                        />
                        <ConfirmAction
                          action={removeExpense}
                          fields={{ id: e.id }}
                          triggerLabel="Remove"
                          triggerName={`Remove ${e.description}`}
                          title="Remove this expense?"
                          description={`${e.description}, ${money(e.amount_minor, e.currency)}. The activity log keeps a record of it.`}
                          confirmLabel="Remove expense"
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </section>
    </>
  );
}

function CurrencySection({
  currency,
  year,
  report,
}: {
  currency: string;
  year: number;
  report: CurrencyReport;
}) {
  const totals = yearTotals(report);
  const products = breakdown(report.by_product, PRODUCT_NAMES);
  const categories = breakdown(report.by_category, EXPENSE_CATEGORIES);
  const activeMonths = MONTHS.map((label, i) => ({
    label,
    income: BigInt(report.income[i] ?? "0"),
    expenses: BigInt(report.expenses[i] ?? "0"),
  })).filter((m) => m.income !== 0n || m.expenses !== 0n);

  return (
    <section aria-labelledby={`cur-${currency}`} className="flex flex-col gap-4">
      <h2 id={`cur-${currency}`} className="font-display text-xl font-bold text-ink">
        {currency === "USD" ? "US dollars" : currency === "LRD" ? "Liberian dollars" : currency}
      </h2>
      <dl className="grid gap-4 lg:grid-cols-3">
        <Total label={`Received in ${year}`} value={money(totals.income, currency)} />
        <Total label="Spent" value={money(totals.expenses, currency)} />
        <Total
          label="Left"
          value={money(totals.left, currency)}
          tone={totals.left < 0n ? "danger" : "brand"}
        />
      </dl>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TableScroll label={`${currency} by month`}>
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th className="text-right">Received</Th>
                  <Th className="text-right">Spent</Th>
                  <Th className="text-right">Left</Th>
                </tr>
              </thead>
              <tbody>
                {activeMonths.map((m) => (
                  <tr key={m.label}>
                    <Td>{m.label}</Td>
                    <Td className="text-right whitespace-nowrap">{majorText(m.income)}</Td>
                    <Td className="text-right whitespace-nowrap">{majorText(m.expenses)}</Td>
                    <Td
                      className={cn(
                        "text-right font-semibold whitespace-nowrap",
                        m.income - m.expenses < 0n ? "text-danger" : "text-ink",
                      )}
                    >
                      {majorText(m.income - m.expenses)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Shares
            title="Received by product"
            rows={products}
            currency={currency}
            empty="No payments."
          />
          <Shares
            title="Spent by category"
            rows={categories}
            currency={currency}
            empty="No expenses."
          />
        </div>
      </div>
    </section>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "brand";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background p-5">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd
        className={cn(
          "font-display text-2xl font-bold break-words",
          tone === "danger" ? "text-danger" : tone === "brand" ? "text-primary" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Shares({
  title,
  rows,
  currency,
  empty,
}: {
  title: string;
  rows: ReturnType<typeof breakdown>;
  currency: string;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-ink-soft">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.key} className="flex flex-col gap-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-ink">{r.label}</span>
                  <span className="font-semibold whitespace-nowrap text-ink">
                    {money(r.amount, currency)}
                  </span>
                </div>
                <div aria-hidden="true" className="h-2 rounded-full bg-surface-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${r.share}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({
  clients,
  today,
  expense,
  triggerLabel,
  title,
}: {
  clients: { id: string; name: string }[];
  today: string;
  expense?: Expense;
  triggerLabel: string;
  title: string;
}) {
  return (
    <FormDialog
      action={saveExpense}
      triggerLabel={expense ? "Edit" : triggerLabel}
      triggerName={expense ? triggerLabel : undefined}
      triggerVariant={expense ? "secondary" : "accent"}
      triggerIcon={expense ? undefined : <Plus aria-hidden="true" />}
      title={title}
      description="What Corex spent: hosting, domains, software and other costs. It is never added to another currency."
      submitLabel={expense ? "Save expense" : "Add expense"}
    >
      <input type="hidden" name="id" value={expense?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="spentOn" label="Date" required>
          <Input type="date" defaultValue={expense?.spent_on ?? today} />
        </FormField>
        <FormField name="category" label="Category" required>
          <Select defaultValue={expense?.category ?? "hosting"}>
            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="description" label="What it was for" required>
          <Input defaultValue={expense?.description ?? ""} placeholder="Vercel Pro, November" />
        </FormField>
        <FormField name="clientId" label="For a client (optional)">
          <Select defaultValue={expense?.client_id ?? ""}>
            <option value="">Not for one client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="currency" label="Currency" required>
          <Select defaultValue={expense?.currency ?? "USD"}>
            <option value="USD">USD</option>
            <option value="LRD">LRD</option>
          </Select>
        </FormField>
        <FormField name="amount" label="Amount" required>
          <Input
            inputMode="decimal"
            defaultValue={expense ? majorText(expense.amount_minor) : ""}
            placeholder="20.00"
          />
        </FormField>
      </div>
    </FormDialog>
  );
}
