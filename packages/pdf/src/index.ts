import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import {
  GradeReportDocument,
  type GradeReportPdfData,
  TranscriptDocument,
  type TranscriptPdfData,
} from "./academic";
import {
  PayslipDocument,
  type PayslipPdfData,
  ReportDocument,
  type ReportPdfData,
} from "./finance";
import { BillingDocument, type BillingDocData } from "./corex-billing";
import { InvoiceDocument, type InvoicePdfData } from "./invoice";
import { ReportCardDocument, type ReportCardPdfData } from "./report-card";
import { ReceiptDocument, type ReceiptPdfData } from "./receipt";

export {
  type CourseResultRow,
  GradeReportDocument,
  type GradeReportPdfData,
  type StudentHeading,
  TranscriptDocument,
  type TranscriptPdfData,
} from "./academic";
export { BillingDocument, type BillingDocData } from "./corex-billing";
export { DocumentFooter } from "./document-footer";
export {
  PayslipDocument,
  type PayslipPdfData,
  ReportDocument,
  type ReportPdfData,
} from "./finance";
export { documentNumber } from "./format";
export { InvoiceDocument, type InvoicePdfData } from "./invoice";
export { Letterhead, type LetterheadData } from "./letterhead";
export { ReceiptDocument, type ReceiptPdfData } from "./receipt";
export { ReportCardDocument, type ReportCardPdfData } from "./report-card";

/** Renders an invoice PDF on the server (SPEC.md 2: generated server-side). */
export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(InvoiceDocument({ data }) as ReactElement<DocumentProps>);
}

/** Renders a receipt PDF on the server. */
export function renderReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return renderToBuffer(ReceiptDocument({ data }) as ReactElement<DocumentProps>);
}

/** Renders a semester grade report PDF. */
export function renderGradeReportPdf(data: GradeReportPdfData): Promise<Buffer> {
  return renderToBuffer(GradeReportDocument({ data }) as ReactElement<DocumentProps>);
}

/** Renders a transcript PDF. */
export function renderTranscriptPdf(data: TranscriptPdfData): Promise<Buffer> {
  return renderToBuffer(TranscriptDocument({ data }) as ReactElement<DocumentProps>);
}

/** Renders a High School report card PDF. */
export function renderReportCardPdf(data: ReportCardPdfData): Promise<Buffer> {
  return renderToBuffer(ReportCardDocument({ data }) as ReactElement<DocumentProps>);
}

/** Renders a payslip PDF from its approved lines. */
export function renderPayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return renderToBuffer(PayslipDocument({ data }) as ReactElement<DocumentProps>);
}

/** Renders a report table PDF (Finance reports). */
export function renderReportPdf(data: ReportPdfData): Promise<Buffer> {
  return renderToBuffer(ReportDocument({ data }) as ReactElement<DocumentProps>);
}

/** Renders a Corex invoice, receipt or quote (Corex Admin, SPEC-ADMIN.md 9.4). */
export function renderBillingPdf(data: BillingDocData): Promise<Buffer> {
  return renderToBuffer(BillingDocument({ data }) as ReactElement<DocumentProps>);
}
