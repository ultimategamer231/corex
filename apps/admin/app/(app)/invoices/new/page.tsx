import { Alert } from "@corex/ui/components/alert";
import { Card, CardContent } from "@corex/ui/components/card";
import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { billingFrom } from "@/lib/billing-settings";
import { prefill } from "@/lib/invoice-prefill";
import { fetchPriceItems, priceOptions } from "@/lib/price-list";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "New invoice" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function NewInvoicePage({ searchParams }: Props) {
  const params = await searchParams;
  const clientParam = one(params.client);
  const clientId = z.uuid().safeParse(clientParam).success ? clientParam : "";
  const { supabase } = await getAdminSession();
  const [{ data: clients }, { data: settings }, prices] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("settings").select("org_name, config").single(),
    fetchPriceItems(supabase),
  ]);
  const billing = billingFrom(settings?.org_name ?? "", settings?.config);
  const { values, error } = await prefill(
    supabase,
    { clientId, kind: one(params.kind), milestone: Number(one(params.milestone)) || undefined },
    billing.termsDays,
  );
  const title =
    values.kind === "milestone"
      ? "New milestone invoice"
      : values.kind === "renewal"
        ? "New renewal invoice"
        : "New invoice";
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/invoices"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Invoices
        </Link>{" "}
        / New
      </nav>
      <PageHeader
        title={title}
        description="A draft has no number. It gets one, and its due date, when you send it."
      />
      {error ? <Alert tone="warning">{error}</Alert> : null}
      <Card>
        <CardContent className="pt-6">
          <InvoiceEditor
            values={values}
            clients={clients ?? []}
            taxRateBp={billing.taxEnabled ? billing.taxRateBp : 0}
            taxLabel={billing.taxLabel}
            lockedClient={values.kind !== "custom"}
            prices={priceOptions(prices)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
