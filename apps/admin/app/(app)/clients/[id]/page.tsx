import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@corex/ui/components/card";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import { cn } from "@corex/ui/lib/utils";
import { Download, FileText, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  removeContact,
  removeDocument,
  saveClientDetails,
  saveContact,
  saveContract,
  saveDeployment,
  saveSubscription,
} from "../actions";
import { FormField } from "@/components/action-form";
import { DocumentUpload } from "@/components/clients/document-upload";
import { ClientStatusBadge } from "@/components/clients/status-badge";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { ConfirmAction } from "@/components/confirm-action";
import { FormDialog } from "@/components/form-dialog";
import { changeLines } from "@/lib/activity";
import {
  CLIENT_PLANS,
  CONTRACT_PRODUCTS,
  contractProductLabel,
  clientPlanLabel,
  ENVIRONMENTS,
  environmentLabel,
  hostingCheck,
  milestoneAmounts,
  money,
} from "@/lib/clients";
import { clientSummary, hostingMultiple } from "@/lib/clients-data";
import { formatDateTime, formatDay, todayIso } from "@/lib/format";
import { fetchInvoices, outstandingTotals } from "@/lib/invoices-data";
import { invoiceStatus } from "@/lib/invoices";
import { getAdminSession } from "@/lib/session";

const TABS = [
  ["overview", "Overview"],
  ["invoices", "Invoices"],
  ["contacts", "Contacts"],
  ["documents", "Documents"],
  ["activity", "Activity"],
] as const;
type Tab = (typeof TABS)[number][0];

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await getAdminSession();
  const summary = await clientSummary(supabase, id);
  if (!summary) notFound();
  return { supabase, summary };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { summary } = await load((await params).id);
  return { title: `${summary.name} | Clients` };
}

/** "Hope Medical Center" → "HM". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Major units for a form field, without the currency sign. */
function major(minor: number | null): string {
  return minor === null ? "" : money(minor, "USD").replace(/^US\$/, "");
}

export default async function ClientPage({ params, searchParams }: Props) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab = (TABS.find(([key]) => key === tabParam)?.[0] ?? "overview") as Tab;
  const { supabase, summary } = await load(id);
  const [{ data: client }, { data: lead }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, country, city, address, notes, source_lead_id")
      .eq("id", id)
      .single(),
    supabase.from("leads").select("id, organization").eq("converted_client_id", id).maybeSingle(),
  ]);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[15px] text-muted">
        <Link
          href="/clients"
          className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary hover:underline"
        >
          Clients
        </Link>{" "}
        / {summary.name}
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-tint font-display text-xl font-bold text-primary-dark"
          >
            {initials(summary.name)}
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                {summary.name}
              </h1>
              <ClientStatusBadge status={summary.status} />
            </div>
            <p className="text-[15px] text-ink-soft">
              {summary.product}
              {summary.plan ? ` · ${summary.plan} plan` : ""}
              {summary.place ? ` · ${summary.place}` : ""} · Client since {summary.since}
              {lead ? (
                <>
                  {" · "}
                  <Link
                    href={`/leads/${lead.id}`}
                    className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                  >
                    Original lead
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/invoices/new?client=${client.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Plus aria-hidden="true" />
            New invoice
          </Link>
          <FormDialog
            action={saveClientDetails}
            triggerLabel="Edit client"
            triggerIcon={<Pencil aria-hidden="true" />}
            title="Edit client"
            description="Changes are recorded in the activity log."
          >
            <input type="hidden" name="clientId" value={client.id} />
            <FormField name="name" label="Name" required>
              <Input defaultValue={client.name} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="city" label="City">
                <Input defaultValue={client.city ?? ""} />
              </FormField>
              <FormField name="country" label="Country">
                <Input defaultValue={client.country ?? ""} />
              </FormField>
            </div>
            <FormField name="address" label="Address">
              <Input defaultValue={client.address ?? ""} />
            </FormField>
            <FormField name="notes" label="Notes">
              <Textarea rows={3} defaultValue={client.notes ?? ""} />
            </FormField>
          </FormDialog>
        </div>
      </header>

      <nav aria-label="Client sections" className="overflow-x-auto">
        <ul className="flex gap-1 border-b border-border">
          {TABS.map(([key, label]) => (
            <li key={key}>
              <Link
                href={key === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${key}`}
                aria-current={key === tab ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 font-semibold whitespace-nowrap",
                  key === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-ink-soft hover:text-primary",
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" ? <Overview id={id} /> : null}
      {tab === "invoices" ? <ClientInvoices id={id} /> : null}
      {tab === "contacts" ? <Contacts id={id} /> : null}
      {tab === "documents" ? <Documents id={id} /> : null}
      {tab === "activity" ? <Activity id={id} /> : null}
    </div>
  );
}

async function Overview({ id }: { id: string }) {
  const { supabase } = await getAdminSession();
  const [{ data: contract }, { data: deployment }, { data: subscription }, minimum] =
    await Promise.all([
      supabase
        .from("contracts")
        .select(
          "id, number, product, plan, total_minor, currency, signed_on, milestone_scheme, notes",
        )
        .eq("client_id", id)
        .order("signed_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("deployments")
        .select(
          "id, product_version, environment, app_url, supabase_project_ref, schema_name, hosting, target_go_live, went_live_on, warranty_ends_on, hosting_cost_minor_per_month, hosting_cost_currency",
        )
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, renewal_amount_minor, currency, starts_on, next_renewal_on")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      hostingMultiple(supabase),
    ]);
  const { data: contractInvoices } = contract
    ? await supabase
        .from("invoices")
        .select("id, kind, milestone_no, renewal_for, status, display_number, due_date")
        .eq("contract_id", contract.id)
        .neq("status", "void")
    : { data: [] };
  const milestoneInvoice = new Map(
    (contractInvoices ?? []).filter((i) => i.kind === "milestone").map((i) => [i.milestone_no, i]),
  );
  const renewalInvoice = (contractInvoices ?? []).find(
    (i) => i.kind === "renewal" && i.renewal_for === subscription?.next_renewal_on,
  );
  const today = todayIso();

  const check = hostingCheck(
    subscription
      ? {
          amountMinor: BigInt(subscription.renewal_amount_minor),
          currency: subscription.currency,
        }
      : null,
    deployment?.hosting_cost_minor_per_month != null && deployment.hosting_cost_currency
      ? {
          monthlyMinor: BigInt(deployment.hosting_cost_minor_per_month),
          currency: deployment.hosting_cost_currency,
        }
      : null,
    minimum,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Payment milestones</CardTitle>
            {contract ? (
              <p className="text-sm text-muted">
                Contract {contract.number} · signed {formatDay(contract.signed_on)} ·{" "}
                {contract.milestone_scheme.join(" / ")}
              </p>
            ) : null}
          </div>
          {contract ? (
            <FormDialog
              action={saveContract}
              triggerLabel="Edit contract"
              triggerIcon={<Pencil aria-hidden="true" />}
              title={`Edit contract ${contract.number}`}
              description="The contract number never changes."
            >
              <input type="hidden" name="contractId" value={contract.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="product" label="Product" required>
                  <Select defaultValue={contract.product}>
                    {CONTRACT_PRODUCTS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="plan" label="Plan" required>
                  <Select defaultValue={contract.plan}>
                    {CLIENT_PLANS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="currency" label="Currency" required>
                  <Select defaultValue={contract.currency}>
                    <option value="USD">USD</option>
                    <option value="LRD">LRD</option>
                  </Select>
                </FormField>
                <FormField name="total" label="Contract amount" required>
                  <Input inputMode="decimal" defaultValue={major(contract.total_minor)} />
                </FormField>
                <FormField name="signedOn" label="Signing date" required>
                  <Input type="date" defaultValue={contract.signed_on} />
                </FormField>
                <FormField name="scheme" label="Payment split (%)" required>
                  <Input defaultValue={contract.milestone_scheme.join("/")} />
                </FormField>
              </div>
              <FormField name="notes" label="Notes">
                <Textarea rows={2} defaultValue={contract.notes ?? ""} />
              </FormField>
            </FormDialog>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {contract ? (
            <>
              <p className="font-display text-2xl font-bold text-ink">
                {money(contract.total_minor, contract.currency)}
                <span className="ml-2 text-sm font-normal text-muted">
                  {contractProductLabel(contract.product)} · {clientPlanLabel(contract.plan)} plan
                </span>
              </p>
              <ol aria-label="Milestones" className="flex flex-col divide-y divide-border-subtle">
                {milestoneAmounts(BigInt(contract.total_minor), contract.milestone_scheme).map(
                  (amount, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-sm font-bold">
                          {i + 1}
                        </span>
                        <span>
                          Milestone {i + 1} of {contract.milestone_scheme.length} (
                          {contract.milestone_scheme[i]}%)
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold">{money(amount, contract.currency)}</span>
                        {(() => {
                          const inv = milestoneInvoice.get(i + 1);
                          return inv ? (
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="inline-flex min-h-11 min-w-11 items-center gap-2 font-semibold text-primary underline"
                            >
                              {inv.display_number ?? "Draft"}
                              <InvoiceStatusBadge
                                status={invoiceStatus(inv.status, inv.due_date, today)}
                              />
                            </Link>
                          ) : (
                            <Link
                              href={`/invoices/new?client=${id}&kind=milestone&milestone=${i + 1}`}
                              className={buttonVariants({ variant: "secondary", size: "sm" })}
                            >
                              Create invoice
                              <span className="sr-only"> for milestone {i + 1}</span>
                            </Link>
                          );
                        })()}
                      </span>
                    </li>
                  ),
                )}
              </ol>
            </>
          ) : (
            <p className="text-muted">No contract.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle>Deployment</CardTitle>
            {deployment ? (
              <Badge variant={deployment.environment === "live" ? "brand" : "info"}>
                {environmentLabel(deployment.environment)}
              </Badge>
            ) : null}
          </div>
          {deployment ? (
            <FormDialog
              action={saveDeployment}
              triggerLabel="Edit deployment"
              triggerIcon={<Pencil aria-hidden="true" />}
              title="Edit deployment"
              description="Setting it to Live records today as the go-live date if none is given, and starts the subscription or warranty."
            >
              <input type="hidden" name="deploymentId" value={deployment.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="environment" label="State" required>
                  <Select defaultValue={deployment.environment}>
                    {ENVIRONMENTS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="productVersion" label="Version" required>
                  <Input defaultValue={deployment.product_version} />
                </FormField>
                <FormField name="appUrl" label="App address">
                  <Input
                    defaultValue={deployment.app_url ?? ""}
                    placeholder="hope-clinic.example.com"
                  />
                </FormField>
                <FormField name="hosting" label="Hosting">
                  <Input
                    defaultValue={deployment.hosting ?? ""}
                    placeholder="Vercel · Corex account"
                  />
                </FormField>
                <FormField name="supabaseProjectRef" label="Supabase project">
                  <Input defaultValue={deployment.supabase_project_ref ?? ""} />
                </FormField>
                <FormField name="schemaName" label="Database schema">
                  <Input
                    defaultValue={deployment.schema_name ?? ""}
                    placeholder="client_hope_medical"
                  />
                </FormField>
                <FormField name="targetGoLive" label="Target go-live">
                  <Input type="date" defaultValue={deployment.target_go_live ?? ""} />
                </FormField>
                <FormField name="wentLiveOn" label="Went live on">
                  <Input type="date" defaultValue={deployment.went_live_on ?? ""} />
                </FormField>
                <FormField name="warrantyEndsOn" label="Warranty ends (Handover)">
                  <Input type="date" defaultValue={deployment.warranty_ends_on ?? ""} />
                </FormField>
                <div className="grid grid-cols-[6.5rem_1fr] gap-3">
                  <FormField name="hostingCurrency" label="Currency">
                    <Select defaultValue={deployment.hosting_cost_currency ?? "USD"}>
                      <option value="USD">USD</option>
                      <option value="LRD">LRD</option>
                    </Select>
                  </FormField>
                  <FormField name="hostingCost" label="Hosting per month">
                    <Input
                      inputMode="decimal"
                      defaultValue={major(deployment.hosting_cost_minor_per_month)}
                    />
                  </FormField>
                </div>
              </div>
            </FormDialog>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {deployment ? (
            <>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Detail term="System">
                  {contract ? contractProductLabel(contract.product) : "—"}{" "}
                  {deployment.product_version}
                </Detail>
                <Detail term="App address">
                  {deployment.app_url ? (
                    <span className="break-all">{deployment.app_url}</span>
                  ) : (
                    "Not set"
                  )}
                </Detail>
                <Detail term="Database">
                  {[deployment.supabase_project_ref, deployment.schema_name]
                    .filter(Boolean)
                    .join(" · ") || "Not set"}
                </Detail>
                <Detail term="Hosting">{deployment.hosting ?? "Not set"}</Detail>
                <Detail term="Target go-live">{formatDay(deployment.target_go_live)}</Detail>
                <Detail term="Went live">{formatDay(deployment.went_live_on)}</Detail>
                {contract?.plan === "handover" ? (
                  <Detail term="Warranty ends">{formatDay(deployment.warranty_ends_on)}</Detail>
                ) : null}
              </dl>
              <p className="text-sm text-muted">
                The admin keeps deployment details only. The client&apos;s own records stay in their
                database and are never shown here.
              </p>
            </>
          ) : (
            <p className="text-muted">No deployment.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <CardTitle>{contract?.plan === "handover" ? "Handover" : "Subscription"}</CardTitle>
          {subscription ? (
            <FormDialog
              action={saveSubscription}
              triggerLabel="Edit subscription"
              triggerIcon={<Pencil aria-hidden="true" />}
              title="Edit subscription"
              description="The renewal date moves forward a year when a renewal invoice is paid (from Block A4)."
            >
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <FormField
                name="renewal"
                label={`Yearly renewal (${subscription.currency})`}
                required
              >
                <Input
                  inputMode="decimal"
                  defaultValue={major(subscription.renewal_amount_minor)}
                />
              </FormField>
              <FormField
                name="nextRenewalOn"
                label="Next renewal"
                hint="Set when the client goes live; change it only to correct it"
              >
                <Input type="date" defaultValue={subscription.next_renewal_on ?? ""} />
              </FormField>
            </FormDialog>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {contract?.plan === "handover" ? (
            <p className="text-[15px] text-ink-soft">
              Handover plan: the client hosts the system. No yearly subscription; a 60-day warranty
              starts at go-live
              {deployment?.warranty_ends_on
                ? ` and ends ${formatDay(deployment.warranty_ends_on)}`
                : ""}
              .
            </p>
          ) : subscription ? (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail term="First-year fee">
                {contract ? money(contract.total_minor, contract.currency) : "—"}
              </Detail>
              <Detail term="Yearly renewal">
                {money(subscription.renewal_amount_minor, subscription.currency)}
              </Detail>
              <Detail term="Next renewal">
                {subscription.next_renewal_on
                  ? formatDay(subscription.next_renewal_on)
                  : "One year after go-live"}
                {renewalInvoice ? (
                  <Link
                    href={`/invoices/${renewalInvoice.id}`}
                    className="ml-2 font-semibold text-primary underline"
                  >
                    {renewalInvoice.display_number ?? "Draft invoice"}
                  </Link>
                ) : subscription.next_renewal_on ? (
                  <Link
                    href={`/invoices/new?client=${id}&kind=renewal`}
                    className="ml-2 font-semibold text-primary underline"
                  >
                    Create renewal invoice
                  </Link>
                ) : null}
              </Detail>
              <Detail term="Hosting cost">
                {deployment?.hosting_cost_minor_per_month != null &&
                deployment.hosting_cost_currency
                  ? `${money(deployment.hosting_cost_minor_per_month, deployment.hosting_cost_currency)} / month`
                  : "Not set"}
              </Detail>
            </dl>
          ) : (
            <p className="text-muted">No subscription.</p>
          )}
          {check.kind === "low" ? (
            <Alert tone="warning">
              The yearly renewal is {check.multiple}× the hosting cost, below your {check.minimum}×
              minimum.
            </Alert>
          ) : check.kind === "ok" ? (
            <Alert tone="success">
              The yearly renewal is {check.multiple}× the hosting cost, above your {check.minimum}×
              minimum.
            </Alert>
          ) : check.kind === "cannot_compare" ? (
            <Alert tone="info">
              The renewal and the hosting cost are in different currencies, so they cannot be
              compared.
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ContactFields({
  contact,
}: {
  contact?: {
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    is_primary: boolean;
    is_billing: boolean;
  };
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="name" label="Name" required>
          <Input defaultValue={contact?.name ?? ""} />
        </FormField>
        <FormField name="title" label="Role">
          <Input defaultValue={contact?.title ?? ""} />
        </FormField>
        <FormField
          name="phone"
          label="Phone or WhatsApp"
          hint="A phone number or an email is needed"
        >
          <Input type="tel" defaultValue={contact?.phone ?? ""} />
        </FormField>
        <FormField name="email" label="Email">
          <Input type="email" defaultValue={contact?.email ?? ""} />
        </FormField>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="isPrimary"
            defaultChecked={contact?.is_primary}
            className="size-5"
          />
          Primary contact (decision maker)
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="isBilling"
            defaultChecked={contact?.is_billing}
            className="size-5"
          />
          Billing contact (receives invoices)
        </label>
      </div>
    </>
  );
}

async function Contacts({ id }: { id: string }) {
  const { supabase } = await getAdminSession();
  const { data } = await supabase
    .from("client_contacts")
    .select("id, name, title, phone, email, is_primary, is_billing")
    .eq("client_id", id)
    .order("is_primary", { ascending: false })
    .order("name");
  const contacts = data ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Contacts</CardTitle>
        <FormDialog
          action={saveContact}
          triggerLabel="Add contact"
          triggerIcon={<Plus aria-hidden="true" />}
          title="Add contact"
        >
          <input type="hidden" name="clientId" value={id} />
          <ContactFields />
        </FormDialog>
      </CardHeader>
      <CardContent>
        <ul aria-label="Contacts" className="flex flex-col divide-y divide-border-subtle">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="flex flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {c.name}
                  {c.is_primary ? <Badge variant="brand">Primary</Badge> : null}
                  {c.is_billing ? <Badge variant="info">Billing</Badge> : null}
                </p>
                {c.title ? <p className="text-sm text-ink-soft">{c.title}</p> : null}
                <p className="text-sm break-all text-ink-soft">
                  {[c.phone, c.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FormDialog
                  action={saveContact}
                  triggerLabel={`Edit ${c.name}`}
                  title={`Edit ${c.name}`}
                >
                  <input type="hidden" name="clientId" value={id} />
                  <input type="hidden" name="contactId" value={c.id} />
                  <ContactFields contact={c} />
                </FormDialog>
                {c.is_primary ? null : (
                  <ConfirmAction
                    action={removeContact}
                    fields={{ clientId: id, contactId: c.id }}
                    triggerLabel={`Remove ${c.name}`}
                    title={`Remove ${c.name}?`}
                    description="The contact is removed from this client. The activity log keeps a record."
                    confirmLabel="Remove"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function fileSize(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

async function Documents({ id }: { id: string }) {
  const { supabase } = await getAdminSession();
  const { data } = await supabase
    .from("client_documents")
    .select("id, name, size_bytes, mime_type, uploaded_at")
    .eq("client_id", id)
    .not("uploaded_at", "is", null)
    .order("uploaded_at", { ascending: false });
  const documents = data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <DocumentUpload clientId={id} />
        {documents.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="No documents yet"
            description="Signed contracts, proposals and acceptance forms belong here."
          />
        ) : (
          <ul aria-label="Documents" className="flex flex-col divide-y divide-border-subtle">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText aria-hidden="true" className="size-5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <p className="font-semibold break-all text-ink">{d.name}</p>
                    <p className="text-sm text-muted">
                      Uploaded {formatDay(d.uploaded_at)} · {fileSize(d.size_bytes)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/clients/${id}/documents/${d.id}`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    <Download aria-hidden="true" />
                    Download<span className="sr-only"> {d.name}</span>
                  </a>
                  <ConfirmAction
                    action={removeDocument}
                    fields={{ clientId: id, documentId: d.id }}
                    triggerLabel={`Remove ${d.name}`}
                    title="Remove this document?"
                    description="The file is deleted from storage. The activity log keeps a record."
                    confirmLabel="Remove"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

type LogRow = {
  seq: number;
  created_at: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  summary: string | null;
  table_name: string;
  record_id: string | null;
  before: unknown;
  after: unknown;
};

async function Activity({ id }: { id: string }) {
  const { supabase } = await getAdminSession();
  const [{ data }, { data: admins }] = await Promise.all([
    supabase
      .from("audit_events")
      .select(
        "seq, created_at, actor_id, actor_type, action, summary, table_name, record_id, before, after",
      )
      .or(
        `record_id.eq.${id},after->>client_id.eq.${id},before->>client_id.eq.${id},after->>converted_client_id.eq.${id}`,
      )
      .order("seq", { ascending: false })
      .limit(100),
    supabase.from("admins").select("user_id, name"),
  ]);
  const names = new Map((admins ?? []).map((a) => [a.user_id, a.name]));
  const rows = (data ?? []) as LogRow[];
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Activity</CardTitle>
        <Link
          href="/activity?area=clients"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Full activity log
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted">Nothing recorded yet.</p>
        ) : (
          <TableScroll label="Client activity">
            <Table>
              <thead>
                <tr>
                  <Th className="w-40">When (GMT)</Th>
                  <Th className="w-40">By</Th>
                  <Th>What happened</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.seq} className="align-top">
                    <Td className="whitespace-nowrap">{formatDateTime(r.created_at)}</Td>
                    <Td>{r.actor_id ? (names.get(r.actor_id) ?? "Former admin") : "System"}</Td>
                    <Td>
                      <p>{r.summary}</p>
                      {r.action === "update" ? (
                        <p className="text-sm break-all text-muted">
                          {changeLines(r).slice(0, 4).join("; ")}
                        </p>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm font-semibold text-muted">{term}</dt>
      <dd className="text-[15px] text-ink">{children}</dd>
    </div>
  );
}

async function ClientInvoices({ id }: { id: string }) {
  const { supabase } = await getAdminSession();
  const [{ rows }, totals] = await Promise.all([
    fetchInvoices(supabase, { clientId: id }, { offset: 0, limit: 100 }),
    outstandingTotals(supabase, id),
  ]);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Invoices</CardTitle>
          <p className="text-sm text-muted">
            Outstanding:{" "}
            {Object.keys(totals).length === 0
              ? "nothing"
              : Object.entries(totals)
                  .map(([c, t]) => money(t.outstanding, c))
                  .join(" · ")}
          </p>
        </div>
        <Link
          href={`/invoices/new?client=${id}`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Plus aria-hidden="true" />
          New invoice
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted">
            No invoices yet. Create milestone invoices from the Overview.
          </p>
        ) : (
          <TableScroll label="Client invoices">
            <Table>
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Description</Th>
                  <Th>Issued</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <Link
                        href={`/invoices/${r.id}`}
                        className={cn(
                          "inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline",
                          r.status === "void" && "line-through",
                        )}
                      >
                        {r.display_number ?? "Draft"}
                      </Link>
                    </Td>
                    <Td>
                      {r.kind === "milestone"
                        ? `Milestone ${r.milestone_no}`
                        : r.kind === "renewal"
                          ? "Yearly renewal"
                          : "Custom"}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDay(r.issue_date)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {money(r.total_minor, r.currency)}
                    </Td>
                    <Td>
                      <InvoiceStatusBadge status={r.shownStatus} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </CardContent>
    </Card>
  );
}
