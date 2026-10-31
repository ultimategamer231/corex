import { Card, CardContent } from "@corex/ui/components/card";
import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getInvoice } from "@/lib/invoices-data";
import { majorText } from "@/lib/invoices";
import { fetchPriceItems, priceOptions } from "@/lib/price-list";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Edit draft" };

type Props = { params: Promise<{ id: string }> };

export default async function EditInvoicePage({ params }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await getAdminSession();
  const found = await getInvoice(supabase, id);
  if (!found) notFound();
  const { invoice, lines } = found;
  if (invoice.status !== "draft") redirect(`/invoices/${id}`);
  const [{ data: clients }, prices] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    fetchPriceItems(supabase),
  ]);
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/invoices"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Invoices
        </Link>{" "}
        /{" "}
        <Link
          href={`/invoices/${id}`}
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Draft
        </Link>{" "}
        / Edit
      </nav>
      <PageHeader title="Edit draft" description={`For ${invoice.clientName}`} />
      <Card>
        <CardContent className="pt-6">
          <InvoiceEditor
            values={{
              invoiceId: invoice.id,
              clientId: invoice.party_id,
              kind: invoice.kind as "custom" | "milestone" | "renewal",
              contractId: invoice.contract_id,
              milestoneNo: invoice.milestone_no,
              renewalFor: invoice.renewal_for,
              currency: invoice.currency,
              termsDays: invoice.payment_terms_days ?? 7,
              discountType: (invoice.discount_type ?? "none") as "none" | "percent" | "fixed",
              discountValue:
                invoice.discount_type === "fixed"
                  ? majorText(invoice.discount_value ?? 0)
                  : invoice.discount_value === null
                    ? ""
                    : String(invoice.discount_value),
              discountReason: invoice.discount_reason ?? "",
              notes: invoice.notes ?? "",
              lines: lines.map((l) => ({
                description: l.description,
                details: l.details ?? "",
                quantity: String(Number(l.quantity)),
                price: majorText(l.unit_amount_minor),
              })),
            }}
            clients={clients ?? []}
            taxRateBp={invoice.tax_rate_bp}
            taxLabel="Tax"
            lockedClient={invoice.kind !== "custom"}
            prices={priceOptions(prices)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
