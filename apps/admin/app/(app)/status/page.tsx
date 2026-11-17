import { Badge } from "@corex/ui/components/badge";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { checkNow } from "./actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { formatDateTime } from "@/lib/format";
import { getAdminSession } from "@/lib/session";

export const metadata: Metadata = { title: "System status" };

const percent = (value: number | null) => (value === null ? "-" : `${Number(value)}%`);

/**
 * System status (audit round A3): the website, the demos and each live client system,
 * checked every 10 minutes. Down systems come first.
 */
export default async function StatusPage() {
  const { supabase } = await getAdminSession();
  const { data, error } = await supabase.rpc("status_overview");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const down = rows.filter((r) => !r.ok).length;

  return (
    <>
      <PageHeader
        title="System status"
        description={
          rows.length === 0
            ? "The website, the demos and each live client system, checked every 10 minutes."
            : down === 0
              ? `All ${rows.length} sites are up. Checked every 10 minutes.`
              : `${down} of ${rows.length} sites down. Checked every 10 minutes.`
        }
        actions={
          <ActionForm action={checkNow} aria-label="Check all sites now">
            <div>
              <SubmitButton variant="secondary" pendingLabel="Checking...">
                Check now
              </SubmitButton>
            </div>
          </ActionForm>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title="No checks yet"
          description="Press Check now, or wait for the next scheduled check. Client systems are checked once their page has an address and they are live or in staging."
        />
      ) : (
        <TableScroll label="Sites and their status">
          <Table>
            <thead>
              <tr>
                <Th>Site</Th>
                <Th>Status</Th>
                <Th>Last checked</Th>
                <Th className="text-right">Response</Th>
                <Th className="text-right">Up, 24 hours</Th>
                <Th className="text-right">Up, 7 days</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.url}>
                  <Td>
                    <span className="font-semibold">{r.target}</span>
                    <br />
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center text-sm text-primary underline"
                    >
                      {r.url.replace(/^https:\/\//, "")}
                    </a>
                  </Td>
                  <Td>
                    <Badge variant={r.ok ? "brand" : "danger"}>{r.ok ? "Up" : "Down"}</Badge>
                    {!r.ok ? (
                      <p className="mt-1 text-sm text-ink-soft">
                        {r.error}
                        {r.down_since ? `. Down since ${formatDateTime(r.down_since)}` : ""}
                      </p>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDateTime(r.checked_at)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {r.ok && r.response_ms !== null
                      ? `${(r.response_ms / 1000).toFixed(1)} s`
                      : "-"}
                  </Td>
                  <Td className="text-right">{percent(r.up_24h)}</Td>
                  <Td className="text-right">{percent(r.up_7d)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </>
  );
}
