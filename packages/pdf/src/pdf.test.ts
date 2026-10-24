import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { renderInvoicePdf, renderReceiptPdf } from "./index";

const org = {
  orgName: "Bethel High School",
  address: "Carey & Johnson Street, Monrovia",
  phone: "+231 770 021 026",
  letterheadText: "Excellence in learning",
};
const generatedAt = new Date("2026-10-24T01:30:00Z");

async function text(pdf: Buffer): Promise<string> {
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}

describe("receipt PDF (CORE-10)", () => {
  it("renders with letterhead, number, amount and generation time", async () => {
    const pdf = await renderReceiptPdf({
      org,
      timezone: "Africa/Monrovia",
      number: 42,
      invoiceNumber: 7,
      receivedFrom: "Jartu Kollie",
      amount: { amountMinor: 500000n, currency: "LRD" },
      method: "mobile_money",
      reference: "OM-88231",
      receivedAt: "2026-10-23T14:05:00Z",
      receivedBy: "Bursar",
      balanceAfter: { amountMinor: 1000000n, currency: "LRD" },
      generatedAt,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const content = await text(pdf);
    for (const expected of [
      "Bethel High School",
      "Excellence in learning",
      "RCT-000042",
      "INV-000007",
      "L$5,000.00",
      "L$10,000.00",
      "Mobile money",
      "OM-88231",
      "Generated 24 Oct 2026, 01:30",
    ]) {
      expect(content).toContain(expected);
    }
  });

  it("marks a voided payment's receipt with the reason", async () => {
    const pdf = await renderReceiptPdf({
      org,
      timezone: "Africa/Monrovia",
      number: 43,
      invoiceNumber: 7,
      receivedFrom: "Jartu Kollie",
      amount: { amountMinor: 100n, currency: "USD" },
      method: "cash",
      receivedAt: "2026-10-23T14:05:00Z",
      balanceAfter: { amountMinor: 0n, currency: "USD" },
      voidReason: "Wrong student",
      generatedAt,
    });
    expect(await text(pdf)).toContain("VOID: Wrong student");
  });
});

describe("invoice PDF", () => {
  it("renders lines, currency in headers and balance", async () => {
    const pdf = await renderInvoicePdf({
      org,
      timezone: "Africa/Monrovia",
      number: 7,
      status: "partially_paid",
      issueDate: "2026-10-01",
      dueDate: "2026-10-31",
      billTo: { name: "Jartu Kollie", detail: "Grade 10 A" },
      lines: [
        {
          description: "Tuition, Semester 1",
          quantity: "1",
          unit: { amountMinor: 1500000n, currency: "LRD" },
          amount: { amountMinor: 1500000n, currency: "LRD" },
        },
      ],
      total: { amountMinor: 1500000n, currency: "LRD" },
      paid: { amountMinor: 500000n, currency: "LRD" },
      balance: { amountMinor: 1000000n, currency: "LRD" },
      generatedAt,
    });
    const content = await text(pdf);
    for (const expected of [
      "INV-000007",
      "Tuition, Semester 1",
      "Amount (LRD)",
      "Balance due",
      "L$10,000.00",
      "1 Oct 2026",
    ]) {
      expect(content).toContain(expected);
    }
  });
});
