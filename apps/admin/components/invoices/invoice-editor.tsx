"use client";

import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { Select } from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";
import { isCurrency, parseMajor } from "@corex/core/money";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { ActionForm, FormField, SubmitButton, useFormResult } from "@/components/action-form";
import { saveDraft } from "@/app/(app)/invoices/actions";
import { money } from "@/lib/clients";
import { invoiceTotals, lineAmount } from "@/lib/invoices";

export type EditorLine = { description: string; details: string; quantity: string; price: string };

export type EditorValues = {
  invoiceId?: string;
  clientId: string;
  kind: "custom" | "milestone" | "renewal";
  contractId?: string | null;
  milestoneNo?: number | null;
  renewalFor?: string | null;
  currency: string;
  termsDays: number;
  discountType: "none" | "percent" | "fixed";
  discountValue: string;
  discountReason: string;
  notes: string;
  lines: EditorLine[];
};

function minorOf(text: string, currency: string): bigint | null {
  if (!isCurrency(currency) || !text.trim()) return null;
  try {
    const v = parseMajor(text, currency).amountMinor;
    return v >= 0n ? v : null;
  } catch {
    return null;
  }
}

function LineErrors() {
  const result = useFormResult();
  const message = result.fieldErrors?.lines;
  return message ? (
    <p role="alert" className="text-sm font-semibold text-danger">
      {message}
    </p>
  ) : null;
}

/**
 * The draft editor (InvoiceNew.dc.html): lines, discount, terms and note, with totals
 * computed live by the same rule the database applies (lib/invoices.ts).
 */
export function InvoiceEditor({
  values,
  clients,
  taxRateBp,
  taxLabel,
  lockedClient,
}: {
  values: EditorValues;
  clients: { id: string; name: string }[];
  taxRateBp: number;
  taxLabel: string;
  lockedClient: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  const [currency, setCurrency] = useState(values.currency);
  const [lines, setLines] = useState<EditorLine[]>(
    values.lines.length
      ? values.lines
      : [{ description: "", details: "", quantity: "1", price: "" }],
  );
  const [discountType, setDiscountType] = useState(values.discountType);
  const [discountValue, setDiscountValue] = useState(values.discountValue);
  const contractInvoice = values.kind !== "custom";

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => {
      const price = minorOf(l.price, currency);
      const qty = Number(l.quantity || "1");
      return price === null || !(qty > 0) ? sum : sum + lineAmount(qty, price);
    }, 0n);
    let discount: { type: "percent" | "fixed"; value: bigint } | null = null;
    if (discountType === "percent" && Number(discountValue) >= 0 && Number(discountValue) <= 100) {
      discount = { type: "percent", value: BigInt(Math.round(Number(discountValue) * 100)) };
    } else if (discountType === "fixed") {
      const fixed = minorOf(discountValue, currency);
      if (fixed !== null) discount = { type: "fixed", value: fixed };
    }
    try {
      return { ...invoiceTotals(subtotal, discount, taxRateBp), error: null };
    } catch {
      return {
        subtotal,
        discount: 0n,
        tax: 0n,
        total: subtotal,
        error: "The discount is more than the subtotal",
      };
    }
  }, [lines, currency, discountType, discountValue, taxRateBp]);

  const update = (i: number, patch: Partial<EditorLine>) =>
    setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <ActionForm
      action={saveDraft}
      resetOnSuccess={false}
      aria-label="Invoice draft"
      className="gap-6"
      onSuccess={(state) => {
        if (state.data?.invoiceId) router.push(`/invoices/${state.data.invoiceId}`);
      }}
    >
      {values.invoiceId ? <input type="hidden" name="invoiceId" value={values.invoiceId} /> : null}
      <input type="hidden" name="kind" value={values.kind} />
      {values.contractId ? (
        <input type="hidden" name="contractId" value={values.contractId} />
      ) : null}
      {values.milestoneNo ? (
        <input type="hidden" name="milestoneNo" value={String(values.milestoneNo)} />
      ) : null}
      {values.renewalFor ? (
        <input type="hidden" name="renewalFor" value={values.renewalFor} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {lockedClient ? (
          <>
            <input type="hidden" name="clientId" value={values.clientId} />
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <span className="text-sm font-semibold text-ink">Client</span>
              <span className="flex min-h-11 items-center font-semibold">
                {clients.find((c) => c.id === values.clientId)?.name ?? "—"}
              </span>
            </div>
          </>
        ) : (
          <FormField name="clientId" label="Client" required>
            <Select defaultValue={values.clientId}>
              <option value="">Choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {contractInvoice ? (
          <>
            <input type="hidden" name="currency" value={currency} />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Currency</span>
              <span className="flex min-h-11 items-center">{currency} (from the contract)</span>
            </div>
          </>
        ) : (
          <FormField name="currency" label="Currency" required>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="LRD">LRD</option>
            </Select>
          </FormField>
        )}
        <FormField
          name="termsDays"
          label="Payment terms (days)"
          required
          hint="Due date = date sent + these days"
        >
          <Input inputMode="numeric" defaultValue={String(values.termsDays)} />
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-display text-lg font-bold text-ink">Lines</legend>
        <LineErrors />
        <ol aria-label="Invoice lines" className="flex flex-col gap-3">
          {lines.map((line, i) => {
            const amount = (() => {
              const price = minorOf(line.price, currency);
              const qty = Number(line.quantity || "1");
              return price === null || !(qty > 0) ? null : lineAmount(qty, price);
            })();
            const id = `${ids}-${i}`;
            return (
              <li
                key={i}
                className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2 sm:items-end xl:grid-cols-[1fr_6rem_9rem_8rem_auto]"
              >
                <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
                  <Label htmlFor={`${id}-d`}>Line {i + 1} description</Label>
                  <Input
                    id={`${id}-d`}
                    name="lineDescription"
                    value={line.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                  />
                  <Label htmlFor={`${id}-x`} className="sr-only">
                    Line {i + 1} details
                  </Label>
                  <Input
                    id={`${id}-x`}
                    name="lineDetails"
                    placeholder="Details (optional)"
                    value={line.details}
                    onChange={(e) => update(i, { details: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-q`}>Quantity</Label>
                  <Input
                    id={`${id}-q`}
                    name="lineQuantity"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-p`}>Unit price ({currency})</Label>
                  <Input
                    id={`${id}-p`}
                    name="linePrice"
                    inputMode="decimal"
                    value={line.price}
                    onChange={(e) => update(i, { price: e.target.value })}
                  />
                </div>
                <p className="flex min-h-11 items-center justify-end font-semibold sm:justify-start">
                  <span className="sr-only">Line {i + 1} amount: </span>
                  {amount === null ? "—" : money(amount, currency)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={lines.length === 1}
                  onClick={() => setLines((all) => all.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden="true" />
                  <span className="sr-only">Remove line {i + 1}</span>
                </Button>
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setLines((all) => [
                ...all,
                { description: "", details: "", quantity: "1", price: "" },
              ])
            }
          >
            <Plus aria-hidden="true" />
            Add line
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <legend className="px-1 font-semibold">Discount (optional)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField name="discountType" label="Type">
                <Select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as EditorValues["discountType"])}
                >
                  <option value="none">No discount</option>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </FormField>
              {discountType !== "none" ? (
                <FormField
                  name="discountValue"
                  label={discountType === "percent" ? "Percent" : `Amount (${currency})`}
                  required
                >
                  <Input
                    inputMode="decimal"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </FormField>
              ) : null}
            </div>
            {discountType !== "none" ? (
              <FormField name="discountReason" label="Reason (internal, never printed)">
                <Input defaultValue={values.discountReason} />
              </FormField>
            ) : null}
          </fieldset>
          <FormField name="notes" label="Note to the client" hint="Printed on the invoice">
            <Textarea rows={3} defaultValue={values.notes} />
          </FormField>
        </div>
        <section aria-label="Totals" className="flex flex-col gap-2 rounded-xl bg-surface p-4">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(totals.subtotal, currency)}</span>
          </p>
          {totals.discount > 0n ? (
            <p className="flex justify-between">
              <span>Discount</span>
              <span>-{money(totals.discount, currency)}</span>
            </p>
          ) : null}
          {taxRateBp > 0 ? (
            <p className="flex justify-between">
              <span>
                {taxLabel} ({(taxRateBp / 100).toString()}%)
              </span>
              <span>{money(totals.tax, currency)}</span>
            </p>
          ) : null}
          <p className="flex justify-between border-t border-border pt-2 font-display text-xl font-bold">
            <span>Total</span>
            <span>{money(totals.total, currency)}</span>
          </p>
          {totals.error ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {totals.error}
            </p>
          ) : null}
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="primary">Save draft</SubmitButton>
      </div>
    </ActionForm>
  );
}
