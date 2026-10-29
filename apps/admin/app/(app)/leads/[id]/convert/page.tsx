import { Card, CardContent } from "@corex/ui/components/card";
import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ClientForm } from "@/components/clients/client-form";
import { productFromLead } from "@/lib/clients";
import { todayIso } from "@/lib/format";
import { LEAD_COLUMNS, type LeadRow, quoteText } from "@/lib/leads-data";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "Convert to client" };

type Props = { params: Promise<{ id: string }> };

/** LEAD-06: the lead's details prefill the client, contact and contract. */
export default async function ConvertLeadPage({ params }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await getAdminSession();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const lead = data as unknown as LeadRow;
  if (lead.converted_client_id) redirect(`/clients/${lead.converted_client_id}`);
  const quote = quoteText(lead);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/leads"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Leads
        </Link>{" "}
        /{" "}
        <Link
          href={`/leads/${lead.id}`}
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
        >
          {lead.organization}
        </Link>{" "}
        / Convert
      </nav>
      <PageHeader
        title="Convert to client"
        description="Creates the client, its primary contact, the contract and the deployment, and a subscription for the Managed plan. The lead is marked Won. A lead converts only once."
      />
      <Card>
        <CardContent className="pt-6">
          <ClientForm
            values={{
              leadId: lead.id,
              name: lead.organization,
              country: lead.country,
              contactName: lead.name,
              contactPhone: lead.phone,
              contactEmail: lead.email,
              product: productFromLead(lead.product),
              plan: lead.plan_interest === "handover" ? "handover" : "managed",
              currency: lead.quote_currency ?? "USD",
              total: quote ? quote.replace(/^(US\$|L\$)/, "") : "",
              signedOn: todayIso(),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
