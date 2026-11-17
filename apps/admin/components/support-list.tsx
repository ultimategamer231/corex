import { Badge } from "@corex/ui/components/badge";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Textarea } from "@corex/ui/components/textarea";
import { Input } from "@corex/ui/components/input";
import { Plus } from "lucide-react";
import Link from "next/link";
import { addSupportItem, updateSupportItem } from "@/app/(app)/support/actions";
import { FormField } from "@/components/action-form";
import { FormDialog } from "@/components/form-dialog";
import { formatDay } from "@/lib/format";
import {
  SUPPORT_KINDS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/lib/money-report";

export type SupportItem = {
  id: string;
  client_id: string;
  opened_on: string;
  kind: keyof typeof SUPPORT_KINDS;
  priority: keyof typeof SUPPORT_PRIORITIES;
  title: string;
  details: string | null;
  status: SupportStatus;
  resolved_on: string | null;
  resolution: string | null;
};

/** The support log as a table; with `clients`, each row names and links its client. */
export function SupportTable({
  items,
  clients,
  label,
}: {
  items: SupportItem[];
  clients?: Map<string, string>;
  label: string;
}) {
  return (
    <TableScroll label={label}>
      <Table>
        <thead>
          <tr>
            <Th>Opened</Th>
            {clients ? <Th>Client</Th> : null}
            <Th>What</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const status = SUPPORT_STATUSES[t.status];
            return (
              <tr key={t.id}>
                <Td className="whitespace-nowrap">{formatDay(t.opened_on)}</Td>
                {clients ? (
                  <Td>
                    <Link
                      href={`/clients/${t.client_id}`}
                      className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                    >
                      {clients.get(t.client_id) ?? "Client"}
                    </Link>
                  </Td>
                ) : null}
                <Td>
                  <span className="font-semibold text-ink">{t.title}</span>
                  <span className="block text-sm text-ink-soft">
                    {SUPPORT_KINDS[t.kind]}
                    {t.priority === "high"
                      ? " · High priority"
                      : t.priority === "low"
                        ? " · Low priority"
                        : ""}
                  </span>
                  {t.details ? (
                    <span className="block text-sm text-ink-soft">{t.details}</span>
                  ) : null}
                  {t.resolution ? (
                    <span className="block text-sm text-ink">Done: {t.resolution}</span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {t.resolved_on ? (
                    <span className="block text-sm text-ink-soft">{formatDay(t.resolved_on)}</span>
                  ) : null}
                </Td>
                <Td>
                  <UpdateDialog item={t} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableScroll>
  );
}

function UpdateDialog({ item }: { item: SupportItem }) {
  return (
    <FormDialog
      action={updateSupportItem}
      triggerLabel="Update"
      triggerName={`Update ${item.title}`}
      title={item.title}
      description="Change the status and note what was done. Items are kept as a record and never deleted."
      submitLabel="Save"
    >
      <input type="hidden" name="id" value={item.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="status" label="Status" required>
          <Select defaultValue={item.status}>
            {Object.entries(SUPPORT_STATUSES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="priority" label="Priority" required>
          <Select defaultValue={item.priority}>
            {Object.entries(SUPPORT_PRIORITIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField name="resolution" label="What was done">
        <Textarea rows={3} defaultValue={item.resolution ?? ""} />
      </FormField>
    </FormDialog>
  );
}

/** Add a support item; with one client, the client is fixed. */
export function AddSupportDialog({
  clients,
  clientId,
}: {
  clients: { id: string; name: string }[];
  clientId?: string;
}) {
  return (
    <FormDialog
      action={addSupportItem}
      triggerLabel="Add support item"
      triggerVariant={clientId ? "secondary" : "accent"}
      triggerIcon={<Plus aria-hidden="true" />}
      title="Add a support item"
      description="An issue, a request or a question from a client."
      submitLabel="Add item"
    >
      {clientId ? (
        <input type="hidden" name="clientId" value={clientId} />
      ) : (
        <FormField name="clientId" label="Client" required>
          <Select defaultValue="">
            <option value="" disabled>
              Choose a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <FormField name="title" label="Short title" required>
        <Input placeholder="Receipts print blank" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="kind" label="Type" required>
          <Select defaultValue="issue">
            {Object.entries(SUPPORT_KINDS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="priority" label="Priority" required>
          <Select defaultValue="normal">
            {Object.entries(SUPPORT_PRIORITIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField name="details" label="Details">
        <Textarea rows={3} />
      </FormField>
    </FormDialog>
  );
}
