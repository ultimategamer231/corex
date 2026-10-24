import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { ACCOUNT_TYPES, loadAccounts } from "@/lib/finance";
import { date, money, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createAccount, setAccountActive } from "./actions";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const { supabase } = await requireRoles(MANAGER);
  const settings = await getSettings();
  const accounts = await loadAccounts(supabase);
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Balance = opening balance plus every entry; it is worked out, never typed in."
      />
      <div className="flex flex-col gap-10">
        <TableScroll label="Accounts">
          <Table>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Type</Th>
                <Th>Opened</Th>
                <Th className="text-right">Balance</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <span className="font-semibold">{a.name}</span>
                    {a.active ? null : (
                      <Badge variant="neutral" className="ml-2">
                        Closed
                      </Badge>
                    )}
                  </Td>
                  <Td>{ACCOUNT_TYPES[a.type]}</Td>
                  <Td className="whitespace-nowrap">{date(a.opened_on, settings.timezone)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {money(a.balance_minor, a.currency)}
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                        href={`/reports?report=statement&account=${a.id}`}
                      >
                        Statement<span className="sr-only"> for {a.name}</span>
                      </Link>
                      <ConfirmAction
                        action={setAccountActive}
                        fields={{ id: a.id, active: a.active ? "false" : "true" }}
                        triggerLabel={a.active ? `Close ${a.name}` : `Reopen ${a.name}`}
                        title={a.active ? `Close ${a.name}?` : `Reopen ${a.name}?`}
                        description={
                          a.active
                            ? "No new entries can use it. Its history and balance stay."
                            : "It can be used for new entries again."
                        }
                        confirmLabel={a.active ? "Close account" : "Reopen account"}
                        variant={a.active ? "danger" : "primary"}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>

        <Section title="Add an account" id="add-account">
          <ActionForm
            action={createAccount}
            aria-label="Add an account"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="name" label="Name" required>
                <Input />
              </FormField>
              <FormField name="type" label="Type" required>
                <Select defaultValue="">
                  <option value="">Choose the type</option>
                  {Object.entries(ACCOUNT_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField name="currency" label="Currency" required>
                <Select defaultValue={settings.baseCurrency}>
                  {settings.enabledCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                name="opening_balance"
                label="Opening balance"
                hint="Money in the account on the opening date"
              >
                <Input inputMode="decimal" defaultValue="0" />
              </FormField>
              <FormField name="opened_on" label="Opening date" required>
                <Input type="date" defaultValue={todayIso(settings.timezone)} />
              </FormField>
            </div>
            <div>
              <SubmitButton>Add account</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
