import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import { configNumber } from "@corex/core/settings";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { schoolEnv } from "@/lib/env";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { EDITION_ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createUser, saveSettings, setMembershipStatus } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, member } = await requireRoles(["super_admin"]);
  const settings = await getSettings();
  const edition = schoolEnv().edition;
  const members = rows(
    await supabase
      .from("memberships")
      .select("user_id, role, status, display_name, created_at")
      .order("display_name"),
  );
  const staffRoles = EDITION_ROLES[edition].filter((r) => r !== "student" && r !== "parent");
  const prefix =
    typeof settings.config.student_number_prefix === "string"
      ? settings.config.student_number_prefix
      : "STU";
  const repeat =
    typeof settings.config.repeat_policy === "string" ? settings.config.repeat_policy : "latest";

  return (
    <>
      <PageHeader
        title="Settings"
        description={`${edition === "college" ? "College / University" : "High School"} edition`}
      />
      <div className="flex flex-col gap-10">
        <Section
          title="Organization"
          id="organization"
          description="Shown in the top bar and on every PDF letterhead."
        >
          <ActionForm
            action={saveSettings}
            resetOnSuccess={false}
            aria-label="Organization settings"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="org_name" label="School name" required className="sm:col-span-2">
                <Input defaultValue={settings.orgName} />
              </FormField>
              <FormField name="address" label="Address" className="sm:col-span-2">
                <Input defaultValue={settings.address ?? ""} />
              </FormField>
              <FormField name="phone" label="Phone">
                <Input type="tel" defaultValue={settings.phone ?? ""} />
              </FormField>
              <FormField name="email" label="Email">
                <Input type="email" defaultValue={settings.email ?? ""} />
              </FormField>
              <FormField
                name="letterhead_text"
                label="Letterhead line"
                hint="For example the school motto."
                className="sm:col-span-2"
              >
                <Textarea rows={2} defaultValue={settings.letterheadText ?? ""} />
              </FormField>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-semibold">Currencies</legend>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name="usd_enabled"
                    defaultChecked={settings.enabledCurrencies.includes("USD")}
                    className="size-5"
                  />
                  US dollars (USD)
                </label>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name="lrd_enabled"
                    defaultChecked={settings.enabledCurrencies.includes("LRD")}
                    className="size-5"
                  />
                  Liberian dollars (LRD)
                </label>
              </fieldset>
              <FormField name="base_currency" label="Main currency" required>
                <Select defaultValue={settings.baseCurrency}>
                  <option value="USD">USD</option>
                  <option value="LRD">LRD</option>
                </Select>
              </FormField>
              <FormField
                name="student_number_prefix"
                label="Student number prefix"
                hint="Numbers look like STU-2026-0001."
                required
              >
                <Input defaultValue={prefix} />
              </FormField>
              <FormField name="repeat_policy" label="Repeated courses in CGPA" required>
                <Select defaultValue={repeat}>
                  <option value="latest">Latest attempt counts</option>
                  <option value="best">Best attempt counts</option>
                  <option value="all">Every attempt counts</option>
                </Select>
              </FormField>
              <FormField name="max_credits_per_term" label="Maximum credits per term" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  defaultValue={configNumber(settings, "max_credits_per_term", 21)}
                />
              </FormField>
              <FormField
                name="min_credits_per_term"
                label="Minimum credits per term"
                hint="Below this, students see a warning."
                required
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  defaultValue={configNumber(settings, "min_credits_per_term", 12)}
                />
              </FormField>
            </div>
            <div>
              <SubmitButton>Save settings</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Users"
          id="users"
          description="Staff accounts and their roles. Student sign-ins are created from each student's page."
        >
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
                      <Badge variant={m.status === "active" ? "brand" : "danger"}>{m.status}</Badge>
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
            aria-label="Add a staff member"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <h3 className="text-lg font-bold">Add a staff member</h3>
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
                  {staffRoles.map((r) => (
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
      </div>
    </>
  );
}
