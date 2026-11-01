import { Badge } from "@corex/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import { Pencil, Plus, Tags } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  forgetMyDevices,
  inviteAdmin,
  saveCompany,
  saveInvoicing,
  newInviteLink,
  passwordResetLink,
  removeAdmin,
  removePriceItem,
  resetAuthenticator,
  runDailyCheck,
  savePriceItem,
  saveRenewals,
  saveSecurity,
} from "../actions";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { InviteForm } from "@/components/invite-form";
import { LinkAction } from "@/components/link-action";
import { SubNav } from "@/components/sub-nav";
import { formatDateTime } from "@/lib/format";
import { getAdminSession } from "@/lib/session";
import { billingFrom, percentText } from "@/lib/billing-settings";
import { securityFrom } from "@/lib/settings";
import { JOB_RULES, ruleOn } from "@/lib/dashboard";
import { lastJobRun } from "@/lib/dashboard-data";
import { FormDialog } from "@/components/form-dialog";
import { majorText } from "@/lib/invoices";
import { MULTIPLE_CHOICES, PRICE_KINDS, type PriceItem, priceText } from "@/lib/price-list";

const SECTIONS = [
  ["company", "Company details"],
  ["invoicing", "Invoicing and payments"],
  ["prices", "Price list"],
  ["renewals", "Renewals"],
  ["team", "Team"],
  ["security", "Security"],
] as const;

type Props = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const label = SECTIONS.find(([key]) => key === section)?.[1];
  return { title: label ? `${label} | Settings` : "Settings" };
}

export default async function SettingsPage({ params }: Props) {
  const { section } = await params;
  if (!SECTIONS.some(([key]) => key === section)) notFound();
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="Settings" description="Every change is recorded in the activity log." />
      <SubNav
        label="Settings sections"
        items={SECTIONS.map(([key, label]) => ({ href: `/settings/${key}`, label }))}
      />
      {section === "team" ? <TeamSection /> : null}
      {section === "security" ? <SecuritySection /> : null}
      {section === "company" ? <CompanySection /> : null}
      {section === "invoicing" ? <InvoicingSection /> : null}
      {section === "prices" ? <PricesSection /> : null}
      {section === "renewals" ? <RenewalsSection /> : null}
    </div>
  );
}

const STATUS = {
  active: { label: "Active", variant: "brand" },
  invited: { label: "Invite pending", variant: "warning" },
  removed: { label: "Removed", variant: "neutral" },
} as const;

async function TeamSection() {
  const { supabase, admin: me, service } = await getAdminSession();
  const [{ data: admins }, { data: sessions }] = await Promise.all([
    supabase
      .from("admins")
      .select("id, user_id, username, name, email, status")
      .order("status")
      .order("name"),
    supabase.from("admin_sessions").select("user_id, last_seen_at"),
  ]);
  const lastSeen = new Map<string, string>();
  for (const s of sessions ?? []) {
    const prev = lastSeen.get(s.user_id);
    if (!prev || prev < s.last_seen_at) lastSeen.set(s.user_id, s.last_seen_at);
  }
  const svc = service();
  const withFactor = new Set<string>();
  await Promise.all(
    (admins ?? [])
      .filter((a) => a.status === "active")
      .map(async (a) => {
        const { data } = await svc.auth.admin.mfa.listFactors({ userId: a.user_id });
        if (data?.factors.some((f) => f.status === "verified")) withFactor.add(a.user_id);
      }),
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Accounts are invite-only. Every admin has full access, and everything they do is
            recorded in the activity log.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <InviteForm action={inviteAdmin} />
          <TableScroll label="Admins">
            <Table>
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Status</Th>
                  <Th>Authenticator</Th>
                  <Th>Last active</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {(admins ?? []).map((a) => {
                  const status = STATUS[a.status as keyof typeof STATUS] ?? STATUS.removed;
                  const self = a.id === me.id;
                  return (
                    <tr key={a.id}>
                      <Td>
                        <p className="font-semibold">
                          {a.name}
                          {self ? <span className="font-normal text-muted"> (you)</span> : null}
                        </p>
                        <p className="text-sm text-muted">
                          {a.username}
                          {a.email ? ` · ${a.email}` : ""}
                        </p>
                      </Td>
                      <Td>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </Td>
                      <Td>
                        {a.status === "active"
                          ? withFactor.has(a.user_id)
                            ? "Set up"
                            : "Not set up"
                          : "—"}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatDateTime(lastSeen.get(a.user_id))}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap justify-end gap-2">
                          {a.status === "invited" ? (
                            <LinkAction
                              action={newInviteLink}
                              fields={{ adminId: a.id }}
                              triggerLabel="New invite link"
                              title={`New invite link for ${a.name}`}
                              description="The old link stops working. The new one works once, for 72 hours."
                              confirmLabel="Create link"
                            />
                          ) : null}
                          {a.status === "active" && !self ? (
                            <>
                              <LinkAction
                                action={passwordResetLink}
                                fields={{ adminId: a.id }}
                                triggerLabel="Reset link"
                                title={`Password reset link for ${a.name}`}
                                description="Creates a link they can use once, within 24 hours, to choose a new password. Send it to them yourself."
                                confirmLabel="Create link"
                              />
                              <LinkAction
                                action={resetAuthenticator}
                                fields={{ adminId: a.id }}
                                triggerLabel="Reset authenticator"
                                title={`Reset the authenticator of ${a.name}?`}
                                description="For a lost or new phone. They are signed out everywhere, their trusted devices are forgotten, and they need the new set-up link to sign in again."
                                confirmLabel="Reset authenticator"
                                variant="danger"
                              />
                            </>
                          ) : null}
                          {a.status !== "removed" && !self ? (
                            <ConfirmAction
                              action={removeAdmin}
                              fields={{ adminId: a.id }}
                              triggerLabel={a.status === "invited" ? "Cancel invite" : "Remove"}
                              title={`Remove ${a.name}?`}
                              description="Their sign-in is blocked at once and they are signed out everywhere. Their past entries stay in the activity log."
                              confirmLabel="Remove"
                            />
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
          <p className="text-sm text-muted">
            Removing an admin blocks their sign-in at once. Their past entries stay in the activity
            log. At least one admin must always remain.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function SecuritySection() {
  const { supabase } = await getAdminSession();
  const { data } = await supabase.from("settings").select("config").single();
  const security = securityFrom(data?.config);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>These protect client contact details and money records.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 rounded-lg bg-surface px-4 py-3">
            <p className="font-semibold">Authenticator code for everyone</p>
            <p className="text-[15px] text-ink-soft">
              After the password, every admin enters a 6-digit code from an authenticator app.
              Always on.
            </p>
          </div>
          <ActionForm action={saveSecurity} resetOnSuccess={false} aria-label="Security settings">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField name="timeout" label="Sign out after inactivity" id="timeout" required>
                <Select defaultValue={String(security.timeoutMinutes)}>
                  <option value="60">1 hour</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                </Select>
              </FormField>
              <FormField
                name="deviceDays"
                label="Trusted devices expire after"
                id="deviceDays"
                required
              >
                <Select defaultValue={String(security.trustedDeviceDays)}>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </Select>
              </FormField>
            </div>
            <SubmitButton variant="primary" className="self-start">
              Save changes
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your trusted devices</CardTitle>
          <CardDescription>
            Forget every browser you trusted. Each asks for a code at its next sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={forgetMyDevices} aria-label="Forget trusted devices">
            <SubmitButton variant="secondary" className="self-start" pendingLabel="Forgetting...">
              Forget my trusted devices
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}

async function CompanySection() {
  const { supabase } = await getAdminSession();
  const { data } = await supabase.from("settings").select("org_name, config").single();
  const b = billingFrom(data?.org_name ?? "", data?.config);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company details</CardTitle>
        <CardDescription>Printed on invoices, receipts and emails.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={saveCompany} resetOnSuccess={false} aria-label="Company details">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="name" label="Company name" required>
              <Input defaultValue={b.company.name} />
            </FormField>
            <FormField name="taxId" label="Tax ID (TIN)">
              <Input defaultValue={b.company.taxId ?? ""} />
            </FormField>
            <FormField name="phone" label="Phone">
              <Input type="tel" defaultValue={b.company.phone ?? ""} />
            </FormField>
            <FormField name="email" label="Email">
              <Input type="email" defaultValue={b.company.email ?? ""} />
            </FormField>
            <FormField name="website" label="Website">
              <Input defaultValue={b.company.website ?? ""} />
            </FormField>
          </div>
          <FormField name="address" label="Office address">
            <Textarea rows={2} defaultValue={b.company.address ?? ""} />
          </FormField>
          <div>
            <SubmitButton variant="primary">Save company details</SubmitButton>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}

async function InvoicingSection() {
  const { supabase } = await getAdminSession();
  const { data } = await supabase.from("settings").select("org_name, config").single();
  const b = billingFrom(data?.org_name ?? "", data?.config);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoicing and payments</CardTitle>
        <CardDescription>
          Changes apply to new drafts and to invoices sent from now on. Sent invoices keep what they
          were sent with.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={saveInvoicing} resetOnSuccess={false} aria-label="Invoicing settings">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              name="termsDays"
              label="Payment terms (days)"
              required
              hint="Due date = date sent + these days; each invoice can change it"
            >
              <Input inputMode="numeric" defaultValue={String(b.termsDays)} />
            </FormField>
            <FormField
              name="invoicePrefix"
              label="Invoice prefix"
              required
              hint={`For example ${b.invoicePrefix}-26-10-001`}
            >
              <Input defaultValue={b.invoicePrefix} />
            </FormField>
            <FormField
              name="receiptPrefix"
              label="Receipt prefix"
              required
              hint={`For example ${b.receiptPrefix}-26-10-001`}
            >
              <Input defaultValue={b.receiptPrefix} />
            </FormField>
          </div>
          <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <legend className="px-1 font-semibold">Tax</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="taxEnabled"
                defaultChecked={b.taxEnabled}
                className="size-5"
              />
              Charge tax on new invoices (after any discount)
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="taxRate"
                label="Rate (%)"
                hint={b.taxEnabled ? `Now ${percentText(b.taxRateBp)}` : "Off"}
              >
                <Input
                  inputMode="decimal"
                  defaultValue={b.taxEnabled ? String(b.taxRateBp / 100) : ""}
                />
              </FormField>
              <FormField name="taxLabel" label="Name on invoices">
                <Input defaultValue={b.taxLabel} placeholder="GST" />
              </FormField>
            </div>
          </fieldset>
          <FormField
            name="paymentInstructions"
            label="Payment instructions"
            hint="Printed on every invoice: bank account, Orange Money and MTN numbers"
          >
            <Textarea rows={4} defaultValue={b.paymentInstructions ?? ""} />
          </FormField>
          <FormField
            name="invoiceTerms"
            label="Terms and notes"
            hint="Printed in the invoice footer"
          >
            <Textarea rows={2} defaultValue={b.invoiceTerms ?? ""} />
          </FormField>
          <div>
            <SubmitButton variant="primary">Save invoicing settings</SubmitButton>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}

async function PricesSection() {
  const { supabase } = await getAdminSession();
  const { data } = await supabase
    .from("price_list_items")
    .select(
      "id, name, kind, currency, managed_year1_minor, renewal_minor, handover_minor, unit_label, active",
    )
    .order("kind")
    .order("position")
    .order("name");
  const items = (data ?? []) as PriceItem[];
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Price list</CardTitle>
          <CardDescription>
            Used to prefill invoices. Changing a price never changes an invoice already drafted.
          </CardDescription>
        </div>
        <PriceDialog />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <EmptyState
            icon={<Tags aria-hidden="true" />}
            title="No prices yet"
            description="Add your products and add-ons with their Managed, renewal and Handover prices."
          />
        ) : (
          <TableScroll label="Price list">
            <Table>
              <thead>
                <tr>
                  <Th scope="col">Item</Th>
                  <Th scope="col" className="text-right">
                    Managed: year 1
                  </Th>
                  <Th scope="col" className="text-right">
                    Renewal per year
                  </Th>
                  <Th scope="col" className="text-right">
                    Handover
                  </Th>
                  <Th scope="col">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <span className="font-semibold">{item.name}</span>
                      <span className="block text-sm text-ink-soft">
                        {PRICE_KINDS.find(([k]) => k === item.kind)?.[1]}
                        {item.unit_label ? ` · ${item.unit_label}` : ""}
                        {item.active ? "" : " · Hidden from invoices"}
                      </span>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {priceText(item.managed_year1_minor, item.currency)}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {priceText(item.renewal_minor, item.currency)}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {priceText(item.handover_minor, item.currency)}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <PriceDialog item={item} />
                        <ConfirmAction
                          action={removePriceItem}
                          fields={{ id: item.id }}
                          triggerLabel={`Remove ${item.name}`}
                          triggerVariant="ghost"
                          triggerSize="sm"
                          title={`Remove ${item.name}?`}
                          description="It no longer appears when you prefill invoices. Invoices already drafted keep their lines."
                          confirmLabel="Remove"
                          variant="danger"
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
        <p className="text-sm text-ink-soft">
          Prices are in each item&apos;s currency. USD and LRD are never added together.
        </p>
      </CardContent>
    </Card>
  );
}

function PriceDialog({ item }: { item?: PriceItem }) {
  const amount = (minor: number | null | undefined) =>
    minor === null || minor === undefined ? "" : majorText(minor);
  return (
    <FormDialog
      action={savePriceItem}
      triggerLabel={item ? `Edit ${item.name}` : "Add item"}
      triggerVariant={item ? "ghost" : "secondary"}
      triggerIcon={item ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
      title={item ? `Edit ${item.name}` : "Add a price list item"}
      description="Leave a price empty when it does not apply."
      submitLabel={item ? "Save item" : "Add item"}
    >
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <FormField name="name" label="Item" required>
        <Input defaultValue={item?.name ?? ""} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="kind" label="Kind" required>
          <Select defaultValue={item?.kind ?? "product"}>
            {PRICE_KINDS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="currency" label="Currency" required>
          <Select defaultValue={item?.currency ?? "USD"}>
            <option value="USD">USD</option>
            <option value="LRD">LRD</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField name="managed" label="Managed: year 1">
          <Input inputMode="decimal" defaultValue={amount(item?.managed_year1_minor)} />
        </FormField>
        <FormField name="renewal" label="Renewal per year">
          <Input inputMode="decimal" defaultValue={amount(item?.renewal_minor)} />
        </FormField>
        <FormField name="handover" label="Handover">
          <Input inputMode="decimal" defaultValue={amount(item?.handover_minor)} />
        </FormField>
      </div>
      <FormField name="unitLabel" label="Unit" hint="For example per day or per hour">
        <Input defaultValue={item?.unit_label ?? ""} />
      </FormField>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="active"
          defaultChecked={item?.active ?? true}
          className="size-5"
        />
        Offer it when prefilling invoices
      </label>
    </FormDialog>
  );
}

async function RenewalsSection() {
  const { supabase } = await getAdminSession();
  const [{ data }, lastRun] = await Promise.all([
    supabase.from("settings").select("config").single(),
    lastJobRun(supabase),
  ]);
  const config = (data?.config ?? {}) as Record<string, unknown>;
  const multiple = String(config.renewal_min_hosting_multiple ?? "3");
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Renewal automation</CardTitle>
          <CardDescription>
            A daily check runs every morning at 07:00 Monrovia time. Nothing is ever paused
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveRenewals} resetOnSuccess={false} aria-label="Renewal settings">
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-2 font-semibold">Rules</legend>
              {JOB_RULES.map(([rule, title, detail]) => (
                <div key={rule} className="flex flex-col py-1">
                  <label className="flex min-h-11 items-center gap-3 font-semibold">
                    <input
                      type="checkbox"
                      name={rule}
                      defaultChecked={ruleOn(config, rule)}
                      aria-describedby={`rule-${rule}-detail`}
                      className="size-5 shrink-0"
                    />
                    {title}
                  </label>
                  <p id={`rule-${rule}-detail`} className="pl-8 text-sm text-ink-soft">
                    {detail}
                  </p>
                </div>
              ))}
              <p className="py-2 text-sm text-ink-soft">
                After the renewal date the client has a 30-day grace period and their system keeps
                running. This cannot be switched off.
              </p>
            </fieldset>
            <FormField
              name="multiple"
              label="Minimum renewal against hosting cost"
              hint="Clients whose yearly renewal is below this many times their yearly hosting cost show a warning"
            >
              <Select defaultValue={MULTIPLE_CHOICES.includes(multiple as never) ? multiple : "3"}>
                {MULTIPLE_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m}×
                  </option>
                ))}
              </Select>
            </FormField>
            <div>
              <SubmitButton variant="primary">Save renewal settings</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Daily check</CardTitle>
          <CardDescription>
            {lastRun ? `Last run ${formatDateTime(lastRun.started_at)}.` : "It has not run yet."}{" "}
            Running it again the same day changes nothing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={runDailyCheck} aria-label="Run the daily check">
            <div>
              <SubmitButton variant="secondary" pendingLabel="Running...">
                Run the daily check now
              </SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
