import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import {
  renderGradeReportPdf,
  renderInvoicePdf,
  renderReceiptPdf,
  renderTranscriptPdf,
} from "./index";

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

const student = { name: "Ama Kpadeh", studentNumber: "TC-2026-0001", program: "BSc Computing" };
const rows = [
  {
    code: "MATH 101",
    title: "College Algebra",
    credits: 3,
    score: "85.00",
    letter: "B",
    gradePoints: "3.00",
  },
  {
    code: "ENG 101",
    title: "English Composition",
    credits: 3,
    score: "92.50",
    letter: "A",
    gradePoints: "4.00",
  },
];

describe("grade report and transcript PDFs (SCH-08)", () => {
  it("renders the grade report with letterhead, results and GPA", async () => {
    const pdf = await renderGradeReportPdf({
      org,
      timezone: "Africa/Monrovia",
      documentNumber: "GR-TC-2026-0001-S1",
      student,
      term: "2026/2027 Semester 1",
      rows,
      termGpa: "3.50",
      cgpa: "3.50",
      creditsEarned: 6,
      generatedAt,
    });
    const content = await text(pdf);
    for (const expected of [
      "Bethel High School",
      "Excellence in learning",
      "Grade report",
      "GR-TC-2026-0001-S1",
      "Ama Kpadeh",
      "TC-2026-0001",
      "2026/2027 Semester 1",
      "MATH 101",
      "92.50",
      "Term GPA",
      "3.50",
      "Generated 24 Oct 2026, 01:30",
    ]) {
      expect(content).toContain(expected);
    }
  });

  it("renders the transcript with every term, CGPA and credits", async () => {
    const pdf = await renderTranscriptPdf({
      org,
      timezone: "Africa/Monrovia",
      documentNumber: "TR-TC-2026-0001-202610240130",
      student,
      terms: [
        { name: "2025/2026 Semester 1", rows, gpa: "3.50", creditsEarned: 6 },
        {
          name: "2025/2026 Semester 2",
          rows: [
            {
              code: "MATH 201",
              title: "Calculus",
              credits: 3,
              score: "71.00",
              letter: "C",
              gradePoints: "2.00",
              note: "Repeated later",
            },
          ],
          gpa: "2.00",
          creditsEarned: 3,
        },
      ],
      cgpa: "3.00",
      creditsEarned: 9,
      creditsRequired: 120,
      generatedAt,
    });
    const content = await text(pdf);
    for (const expected of [
      "Academic transcript",
      "TR-TC-2026-0001-202610240130",
      "2025/2026 Semester 1",
      "2025/2026 Semester 2",
      "Repeated later",
      "Cumulative GPA",
      "9 of 120",
      "Generated 24 Oct 2026, 01:30",
    ]) {
      expect(content).toContain(expected);
    }
  });
});
