import { Alert } from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { demoInstance } from "@/lib/demo";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { ADMIN, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import {
  addService,
  createUser,
  saveSettings,
  setMembershipStatus,
  setServiceActive,
  setServicePrice,
} from "./actions";

export const metadata: Metadata = { title: "Settings" };

const panel = "max-w-3xl rounded-xl border border-border bg-background p-5";

export default async function SettingsPage() {
  const { supabase, member } = await requireRoles(ADMIN);
  // The demo shows organization settings and users read-only (SPEC.md 11.3).
  const demo = demoInstance() !== null;
  const settings = await getSettings();
  const [services, members] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, code, price_minor, currency, active")
      .order("name")
      .then(rows),
    supabase
      .from("memberships")
      .select("user_id, role, status, display_name")
      .order("display_name")
      .then(rows),
  ]);
  const offered = services.filter((s) => s.active);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-10">
        {demo ? (
          <Alert tone="info">
            Organization settings, users and roles cannot be changed in the demo.
          </Alert>
        ) : (
          <Section
            title="Organization"
            id="organization"
            description="Shown in the top bar and on every PDF."
          >
            <ActionForm
              action={saveSettings}
              resetOnSuccess={false}
              aria-label="Organization settings"
              className={panel}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="org_name" label="Organization name" required>
                  <Input defaultValue={settings.orgName} />
                </FormField>
                <FormField name="phone" label="Phone">
                  <Input type="tel" defaultValue={settings.phone ?? ""} />
                </FormField>
                <FormField name="email" label="Email">
                  <Input type="email" defaultValue={settings.email ?? ""} />
                </FormField>
                <FormField name="address" label="Address">
                  <Input defaultValue={settings.address ?? ""} />
                </FormField>
              </div>
              <FormField name="letterhead_text" label="Letterhead line">
                <Textarea rows={2} defaultValue={settings.letterheadText ?? ""} />
              </FormField>
              <div>
                <SubmitButton>Save settings</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        )}

        <Section
          title="Price list"
          id="services"
          description="Bills are built from these services and prices."
        >
          {services.length === 0 ? (
            <p className="text-muted">No services yet.</p>
          ) : (
            <TableScroll label="Price list">
              <Table>
                <thead>
                  <tr>
                    <Th>Service</Th>
                    <Th>Code</Th>
                    <Th className="text-right">Price</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <Td className="font-semibold">
                        {s.name}
                        {s.active ? null : (
                          <Badge variant="neutral" className="ml-2">
                            Hidden
                          </Badge>
                        )}
                      </Td>
                      <Td>{s.code}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {money(s.price_minor, s.currency)}
                      </Td>
                      <Td className="text-right">
                        <ConfirmAction
                          action={setServiceActive}
                          fields={{ id: s.id, active: s.active ? "false" : "true" }}
                          triggerLabel={s.active ? `Hide ${s.name}` : `Offer ${s.name} again`}
                          title={s.active ? `Hide ${s.name}?` : `Offer ${s.name} again?`}
                          description={
                            s.active
                              ? "New bills cannot use it. Past bills and reports keep it."
                              : "New bills can use it again."
                          }
                          confirmLabel={s.active ? "Hide" : "Offer again"}
                          variant={s.active ? "danger" : "primary"}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
          <ActionForm action={addService} aria-label="Add a service" className={panel}>
            <h3 className="text-lg font-bold">Add a service</h3>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_1fr]">
              <FormField name="name" label="Name" required>
                <Input autoComplete="off" />
              </FormField>
              <FormField name="code" label="Code" required>
                <Input autoComplete="off" />
              </FormField>
              <FormField name="currency" label="Currency" required>
                <Select defaultValue={settings.baseCurrency}>
                  <option value="USD">USD</option>
                  <option value="LRD">LRD</option>
                </Select>
              </FormField>
              <FormField name="price" label="Price" required>
                <Input inputMode="decimal" autoComplete="off" />
              </FormField>
            </div>
            <div>
              <SubmitButton variant="secondary">Add service</SubmitButton>
            </div>
          </ActionForm>
          {offered.length ? (
            <ActionForm action={setServicePrice} aria-label="Change a price" className={panel}>
              <h3 className="text-lg font-bold">Change a price</h3>
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <FormField name="id" label="Service" required>
                  <Select defaultValue="">
                    <option value="">Choose a service</option>
                    {offered.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.currency})
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="price" label="New price" required>
                  <Input inputMode="decimal" autoComplete="off" />
                </FormField>
              </div>
              <div>
                <SubmitButton variant="secondary">Save price</SubmitButton>
              </div>
            </ActionForm>
          ) : null}
        </Section>

        {demo ? null : (
          <Section title="Users" id="users" description="Sign-ins and their roles.">
            <TableScroll label="Users">
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={`${m.user_id}-${m.role}`}>
                      <Td className="font-semibold">{m.display_name}</Td>
                      <Td>{ROLE_LABEL[m.role as Role] ?? m.role}</Td>
                      <Td>
                        <Badge variant={m.status === "active" ? "brand" : "danger"}>
                          {m.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {m.user_id === member.userId ? null : (
                          <ConfirmAction
                            action={setMembershipStatus}
                            fields={{
                              user_id: m.user_id,
                              role: m.role,
                              status: m.status === "active" ? "suspended" : "active",
                            }}
                            triggerLabel={
                              m.status === "active"
                                ? `Suspend ${m.display_name}`
                                : `Restore ${m.display_name}`
                            }
                            title={
                              m.status === "active"
                                ? `Suspend ${m.display_name}?`
                                : `Restore ${m.display_name}?`
                            }
                            description={
                              m.status === "active"
                                ? "They lose access at once, even if signed in. Their records stay."
                                : "They can sign in again with their existing password."
                            }
                            confirmLabel={m.status === "active" ? "Suspend" : "Restore"}
                            variant={m.status === "active" ? "danger" : "primary"}
                          />
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
            <ActionForm
              action={createUser}
              resetOnSuccess={false}
              aria-label="Add a user"
              className={panel}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField name="display_name" label="Name" required>
                  <Input />
                </FormField>
                <FormField name="email" label="Email" required>
                  <Input type="email" />
                </FormField>
                <FormField name="role" label="Role" required>
                  <Select defaultValue="">
                    <option value="">Choose a role</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div>
                <SubmitButton>Create account</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        )}
      </div>
    </>
  );
}
