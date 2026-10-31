import { describe, expect, it } from "vitest";
import { billingFrom, invoicingSchema } from "./billing-settings";
import {
  draftPayload,
  draftSchema,
  invoiceStatus,
  invoiceTotals,
  lineAmount,
  majorText,
  paymentSchema,
} from "./invoices";

const clientId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("INV-01 to INV-04: totals, the same rule as the database", () => {
  it("rounds percent discounts and tax half up, tax after the discount", () => {
    // Same cases as packages/db/test/admin-billing.db.test.ts.
    expect(invoiceTotals(1005n, { type: "percent", value: 1000n }, 0)).toEqual({
      subtotal: 1005n,
      discount: 101n,
      tax: 0n,
      total: 904n,
    });
    expect(invoiceTotals(70100n, { type: "fixed", value: 5000n }, 1000)).toEqual({
      subtotal: 70100n,
      discount: 5000n,
      tax: 6510n,
      total: 71610n,
    });
    expect(invoiceTotals(333n, { type: "percent", value: 5000n }, 750)).toMatchObject({
      discount: 167n,
      tax: 12n,
      total: 178n,
    });
    expect(() => invoiceTotals(1000n, { type: "fixed", value: 2000n }, 0)).toThrow(
      /more than the subtotal/,
    );
  });

  it("line amounts are quantity × price, rounded half up", () => {
    expect(lineAmount(2, 10025n)).toBe(20050n);
    expect(lineAmount(1.5, 333n)).toBe(500n);
    expect(lineAmount(0.25, 2n)).toBe(1n);
  });
});

describe("draft form", () => {
  const base = {
    clientId,
    currency: "USD",
    termsDays: "7",
    lineDescription: ["Setup", ""],
    lineDetails: ["Server and data", ""],
    lineQuantity: ["2", "1"],
    linePrice: ["1,250.50", ""],
  };

  it("keeps filled lines, skips empty ones and builds the database payload", () => {
    const data = draftSchema.parse({
      ...base,
      discountType: "percent",
      discountValue: "12.5",
      discountReason: "Early client",
    });
    expect(draftPayload(data)).toMatchObject({
      client_id: clientId,
      kind: "custom",
      payment_terms_days: 7,
      discount_type: "percent",
      discount_value: 12.5,
      discount_reason: "Early client",
      lines: [
        {
          description: "Setup",
          details: "Server and data",
          quantity: 2,
          unit_amount_minor: 125050,
        },
      ],
    });
  });

  it("needs a line, valid quantities and prices, and a sensible discount", () => {
    const empty = draftSchema.safeParse({ ...base, lineDescription: "", linePrice: "" });
    expect(empty.error?.issues.map((i) => i.message)).toContain("Add at least one line");
    const badQty = draftSchema.safeParse({ ...base, lineQuantity: ["0.001", "1"] });
    expect(badQty.error?.issues[0]?.message).toMatch(/quantity above zero/);
    const badPct = draftSchema.safeParse({
      ...base,
      discountType: "percent",
      discountValue: "120",
    });
    expect(badPct.error?.issues[0]?.path).toEqual(["discountValue"]);
    const days = draftSchema.safeParse({ ...base, termsDays: "400" });
    expect(days.success).toBe(false);
  });
});

describe("PAY-01: payment form", () => {
  it("needs an amount above zero and a known method", () => {
    const ok = paymentSchema.parse({
      invoiceId: clientId,
      paymentId: clientId,
      currency: "LRD",
      amount: "15,000",
      method: "mtn_momo",
      receivedOn: "2026-10-31",
    });
    expect(ok.amountMinor).toBe(1500000n);
    expect(paymentSchema.safeParse({ ...ok, amount: "0", receivedOn: "2026-10-31" }).success).toBe(
      false,
    );
    expect(paymentSchema.safeParse({ ...ok, amount: "5", method: "cheque" }).success).toBe(false);
  });
});

describe("PAY-04: statuses", () => {
  it("derives overdue from the due date", () => {
    expect(invoiceStatus("issued", "2026-10-30", "2026-10-31")).toBe("overdue");
    expect(invoiceStatus("partially_paid", "2026-10-30", "2026-10-31")).toBe("overdue");
    expect(invoiceStatus("issued", "2026-10-31", "2026-10-31")).toBe("sent");
    expect(invoiceStatus("paid", "2026-01-01", "2026-10-31")).toBe("paid");
    expect(invoiceStatus("draft", null, "2026-10-31")).toBe("draft");
  });
});

describe("billing settings", () => {
  it("default to 7-day terms, CX/RC numbers and no tax (owner decisions)", () => {
    expect(billingFrom("Corex", {})).toMatchObject({
      termsDays: 7,
      invoicePrefix: "CX",
      receiptPrefix: "RC",
      taxEnabled: false,
      taxRateBp: 0,
    });
  });

  it("store tax as basis points and need distinct prefixes", () => {
    const ok = invoicingSchema.parse({
      termsDays: "14",
      invoicePrefix: "CX",
      receiptPrefix: "RC",
      taxEnabled: "on",
      taxRate: "7.5",
    });
    expect(ok.taxRateBp).toBe(750);
    expect(
      invoicingSchema.safeParse({ termsDays: "7", invoicePrefix: "CX", receiptPrefix: "CX" })
        .success,
    ).toBe(false);
    expect(majorText(125050)).toBe("1250.50");
  });
});
