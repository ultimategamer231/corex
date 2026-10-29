import { Card, CardContent } from "@corex/ui/components/card";
import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { addLead } from "../actions";
import { LeadForm } from "@/components/leads/lead-form";

export const metadata: Metadata = { title: "Add lead" };

export default function NewLeadPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/leads"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Leads
        </Link>{" "}
        / Add lead
      </nav>
      <PageHeader
        title="Add lead"
        description="For requests that came by phone, WhatsApp, email or in person."
      />
      <Card>
        <CardContent className="pt-6">
          <LeadForm action={addLead} submitLabel="Add lead" />
        </CardContent>
      </Card>
    </div>
  );
}
