import { contractProductLabel, milestoneAmounts } from "./clients";
import { formatDay } from "./format";
import { type EditorLine, type EditorValues } from "@/components/invoices/invoice-editor";
import { majorText } from "./invoices";
import type { AdminDb } from "./supabase";

/**
 * A new draft's values: a payment milestone or the yearly renewal from the client's
 * contract (SPEC-ADMIN.md 9.1), or an empty custom invoice.
 */
export async function prefill(
  db: AdminDb,
  params: { clientId: string; kind: string; milestone?: number },
  termsDays: number,
): Promise<{ values: EditorValues; error?: string }> {
  const base: EditorValues = {
    clientId: params.clientId,
    kind: "custom",
    currency: "USD",
    termsDays,
    discountType: "none",
    discountValue: "",
    discountReason: "",
    notes: "",
    lines: [],
  };
  if (!params.clientId || (params.kind !== "milestone" && params.kind !== "renewal")) {
    return { values: base };
  }
  const { data: contract } = await db
    .from("contracts")
    .select("id, number, product, plan, total_minor, currency, milestone_scheme")
    .eq("client_id", params.clientId)
    .order("signed_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!contract) return { values: base, error: "This client has no contract." };
  const product = contractProductLabel(contract.product);

  if (params.kind === "milestone") {
    const n = params.milestone ?? 1;
    const scheme = contract.milestone_scheme;
    const amounts = milestoneAmounts(BigInt(contract.total_minor), scheme);
    const amount = amounts[n - 1];
    if (amount === undefined) return { values: base, error: "This milestone does not exist." };
    const line: EditorLine = {
      description: `Milestone ${n} of ${scheme.length} (${scheme[n - 1]}%)`,
      details: `${product}, contract ${contract.number}`,
      quantity: "1",
      price: majorText(amount),
    };
    return {
      values: {
        ...base,
        kind: "milestone",
        contractId: contract.id,
        milestoneNo: n,
        currency: contract.currency,
        lines: [line],
      },
    };
  }

  const { data: sub } = await db
    .from("subscriptions")
    .select("renewal_amount_minor, currency, next_renewal_on")
    .eq("contract_id", contract.id)
    .maybeSingle();
  if (!sub?.next_renewal_on) {
    return { values: base, error: "The subscription starts when the client goes live." };
  }
  const end = new Date(`${sub.next_renewal_on}T00:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    values: {
      ...base,
      kind: "renewal",
      contractId: contract.id,
      renewalFor: sub.next_renewal_on,
      currency: contract.currency,
      lines: [
        {
          description: "Yearly renewal",
          details: `${product}, ${formatDay(sub.next_renewal_on)} to ${formatDay(end.toISOString().slice(0, 10))}`,
          quantity: "1",
          price: majorText(sub.renewal_amount_minor),
        },
      ],
    },
  };
}
