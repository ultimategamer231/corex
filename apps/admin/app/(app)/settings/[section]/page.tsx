import { Badge } from "@corex/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Construction } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  forgetMyDevices,
  inviteAdmin,
  newInviteLink,
  passwordResetLink,
  removeAdmin,
  resetAuthenticator,
  saveSecurity,
} from "../actions";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { InviteForm } from "@/components/invite-form";
import { LinkAction } from "@/components/link-action";
import { SubNav } from "@/components/sub-nav";
import { formatDateTime } from "@/lib/format";
import { getAdminSession } from "@/lib/session";
import { securityFrom } from "@/lib/settings";

const SECTIONS = [
  ["company", "Company details"],
  ["invoicing", "Invoicing and payments"],
  ["prices", "Price list"],
  ["renewals", "Renewals"],
  ["team", "Team"],
  ["security", "Security"],
] as const;

type Section = (typeof SECTIONS)[number][0];

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
      {section !== "team" && section !== "security" ? <Later section={section as Section} /> : null}
    </div>
  );
}

function Later({ section }: { section: Section }) {
  const text: Record<string, string> = {
    company: "Company details printed on invoices, receipts and emails.",
    invoicing: "Numbering, payment terms, tax and the payment instructions printed on invoices.",
    prices: "The price list used to prefill invoices and quotes.",
    renewals: "The renewal reminders and the minimum renewal against hosting cost.",
  };
  return (
    <EmptyState
      icon={<Construction />}
      title="This section is being built"
      description={text[section] ?? ""}
    />
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
