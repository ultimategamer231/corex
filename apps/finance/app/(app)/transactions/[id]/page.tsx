import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmAction } from "@/components/confirm-action";
import { date, money } from "@/lib/format";
import { signedFileUrl } from "@/lib/files";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { MANAGER, RECORDERS } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { voidEntry } from "../actions";

export const metadata: Metadata = { title: "Transaction" };

const TYPES = { income: "Income", expense: "Expense", transfer: "Transfer" } as const;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

export default async function TransactionPage({ params, searchParams }: Props) {
  const { supabase, member } = await requireRoles(RECORDERS);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const t = await supabase
    .from("transactions")
    .select(
      "id, type, date, amount_minor, currency, fx_rate_to_base, base_amount_minor, memo, status, void_reason, reversal_of_id, invoice_payment_id, receipt_file_id, created_at, account:accounts!transactions_account_id_fkey(name), to_account:accounts!transactions_to_account_id_fkey(name), categories(name), counterparties(name)",
    )
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!t) notFound();
  const reversal = await supabase
    .from("transactions")
    .select("id")
    .eq("reversal_of_id", id)
    .maybeSingle()
    .then(rows);
  const receiptUrl = t.receipt_file_id ? await signedFileUrl(t.receipt_file_id) : null;
  const canVoid =
    memberHas(member, MANAGER) &&
    t.status === "posted" &&
    !t.reversal_of_id &&
    !t.invoice_payment_id;
  const details: [string, React.ReactNode][] = [
    ["Date", date(t.date, settings.timezone)],
    ["Amount", money(t.amount_minor, t.currency)],
    ...(t.currency === settings.baseCurrency
      ? []
      : ([
          [
            `In ${settings.baseCurrency}`,
            `${money(t.base_amount_minor, settings.baseCurrency)} at ${Number(t.fx_rate_to_base)}`,
          ],
        ] as [string, React.ReactNode][])),
    [t.type === "transfer" ? "From account" : "Account", t.account?.name ?? ""],
    ...(t.type === "transfer"
      ? ([["To account", t.to_account?.name ?? ""]] as [string, React.ReactNode][])
      : ([
          ["Category", t.categories?.name ?? ""],
          [t.type === "income" ? "Customer" : "Vendor", t.counterparties?.name ?? "None"],
        ] as [string, React.ReactNode][])),
    ["Note", t.memo ?? "None"],
  ];

  return (
    <>
      <PageHeader
        title={`${TYPES[t.type as keyof typeof TYPES]}${t.reversal_of_id ? " reversal" : ""}`}
        description={
          t.status === "void" && !t.reversal_of_id ? `Void: ${t.void_reason}` : undefined
        }
        actions={
          canVoid ? (
            <ConfirmAction
              action={voidEntry}
              fields={{ id: t.id }}
              triggerLabel="Void entry"
              title="Void this entry?"
              description="A reversal is added with the same amount, so the balance goes back. Both stay in the history."
              confirmLabel="Void entry"
              reasonLabel="Reason"
            />
          ) : null
        }
      />
      <div className="flex max-w-2xl flex-col gap-5">
        {(await searchParams).saved ? <Alert tone="success">Entry saved.</Alert> : null}
        {t.invoice_payment_id ? (
          <Alert tone="info">This entry is an invoice payment. Void it from the invoice.</Alert>
        ) : null}
        <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-border bg-background p-5 sm:grid-cols-[12rem_1fr]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-ink-soft">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="contents">
            <dt className="font-semibold text-ink-soft">Status</dt>
            <dd>
              {t.status === "void" ? (
                <Badge variant="danger">Void</Badge>
              ) : (
                <Badge variant="brand">Posted</Badge>
              )}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-4">
          {receiptUrl ? (
            <a
              className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open the receipt
            </a>
          ) : null}
          {t.reversal_of_id ? (
            <Link
              className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
              href={`/transactions/${t.reversal_of_id}`}
            >
              See the original entry
            </Link>
          ) : null}
          {reversal ? (
            <Link
              className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
              href={`/transactions/${reversal.id}`}
            >
              See the reversal
            </Link>
          ) : null}
          <Link
            className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
            href="/transactions"
          >
            Back to transactions
          </Link>
        </div>
      </div>
    </>
  );
}
