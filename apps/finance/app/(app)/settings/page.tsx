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
import { loadCategories } from "@/lib/finance";
import { date, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { MANAGER, OWNER, ROLE_LABEL, type Role } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import {
  addCategory,
  addRate,
  createUser,
  saveSettings,
  setCategoryActive,
  setMembershipStatus,
} from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, member } = await requireRoles(MANAGER);
  const owner = memberHas(member, OWNER);
  const settings = await getSettings();
  const [categories, rates, members] = await Promise.all([
    loadCategories(supabase),
    supabase
      .from("exchange_rates")
      .select("id, date, from_currency, to_currency, rate")
      .order("date", { ascending: false })
      .limit(10)
      .then(rows),
    owner
      ? supabase
          .from("memberships")
          .select("user_id, role, status, display_name")
          .order("display_name")
          .then(rows)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-10">
        {owner ? (
          <Section
            title="Organization"
            id="organization"
            description="Shown in the top bar and on every PDF."
          >
            <ActionForm
              action={saveSettings}
              resetOnSuccess={false}
              aria-label="Organization settings"
              className="max-w-3xl rounded-xl border border-border bg-background p-5"
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
                <FormField
                  name="base_currency"
                  label="Base currency"
                  hint="Reports are in this currency. It can change only before the first entry."
                >
                  <Select defaultValue={settings.baseCurrency}>
                    <option value="USD">USD</option>
                    <option value="LRD">LRD</option>
                  </Select>
                </FormField>
              </div>
              <FormField name="address" label="Address">
                <Input defaultValue={settings.address ?? ""} />
              </FormField>
              <FormField name="letterhead_text" label="Letterhead line">
                <Textarea rows={2} defaultValue={settings.letterheadText ?? ""} />
              </FormField>
              <div>
                <SubmitButton>Save settings</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        ) : null}

        <Section
          title="Categories"
          id="categories"
          description="Income and expense categories for entries and reports."
        >
          <TableScroll label="Categories">
            <Table>
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th>Type</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-semibold">
                      {c.name}
                      {c.active ? null : (
                        <Badge variant="neutral" className="ml-2">
                          Hidden
                        </Badge>
                      )}
                    </Td>
                    <Td>{c.type === "income" ? "Income" : "Expense"}</Td>
                    <Td className="text-right">
                      <ConfirmAction
                        action={setCategoryActive}
                        fields={{ id: c.id, active: c.active ? "false" : "true" }}
                        triggerLabel={c.active ? `Hide ${c.name}` : `Use ${c.name} again`}
                        title={c.active ? `Hide ${c.name}?` : `Use ${c.name} again?`}
                        description={
                          c.active
                            ? "New entries cannot use it. Past entries and reports keep it."
                            : "New entries can use it again."
                        }
                        confirmLabel={c.active ? "Hide" : "Use again"}
                        variant={c.active ? "danger" : "primary"}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
          <ActionForm
            action={addCategory}
            aria-label="Add a category"
            className="flex max-w-3xl flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-5"
          >
            <FormField name="name" label="Name" required className="w-64 max-w-full">
              <Input />
            </FormField>
            <FormField name="type" label="Type" required className="w-44">
              <Select defaultValue="">
                <option value="">Choose</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </FormField>
            <SubmitButton variant="secondary">Add category</SubmitButton>
          </ActionForm>
        </Section>

        <Section
          title="Exchange rates"
          id="rates"
          description="Reference rates that fill in new entries. Each entry keeps the rate it was saved with, so past reports never change."
        >
          {rates.length === 0 ? (
            <p className="text-muted">No rates yet.</p>
          ) : (
            <TableScroll label="Exchange rates">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap">{date(r.date, settings.timezone)}</Td>
                      <Td>
                        1 {r.from_currency} = {Number(r.rate)} {r.to_currency}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
          <ActionForm
            action={addRate}
            aria-label="Add an exchange rate"
            className="flex max-w-3xl flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-5"
          >
            <FormField name="date" label="Date" required className="w-44">
              <Input type="date" defaultValue={todayIso(settings.timezone)} />
            </FormField>
            <FormField name="from_currency" label="1 unit of" required className="w-28">
              <Select defaultValue="USD">
                <option value="USD">USD</option>
                <option value="LRD">LRD</option>
              </Select>
            </FormField>
            <FormField name="rate" label="Equals" required className="w-36">
              <Input inputMode="decimal" />
            </FormField>
            <FormField name="to_currency" label="Of" required className="w-28">
              <Select defaultValue="LRD">
                <option value="LRD">LRD</option>
                <option value="USD">USD</option>
              </Select>
            </FormField>
            <SubmitButton variant="secondary">Save rate</SubmitButton>
          </ActionForm>
        </Section>

        {owner ? (
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
                                ? "They lose access at once, even if signed in. Their entries stay."
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
              className="max-w-3xl rounded-xl border border-border bg-background p-5"
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
                    {(["owner", "admin", "accountant", "staff"] as const).map((r) => (
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
        ) : null}
      </div>
    </>
  );
}
