import { Card, CardContent } from "@corex/ui/components/card";
import { PageHeader } from "@corex/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientForm } from "@/components/clients/client-form";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/clients"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Clients
        </Link>{" "}
        / Add client
      </nav>
      <PageHeader
        title="Add client"
        description="For a client who did not come through a lead. Leads become clients from their own page."
      />
      <Card>
        <CardContent className="pt-6">
          <ClientForm values={{ signedOn: todayIso() }} />
        </CardContent>
      </Card>
    </div>
  );
}
