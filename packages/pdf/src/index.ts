import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import {
  GradeReportDocument,
  type GradeReportPdfData,
  TranscriptDocument,
  type TranscriptPdfData,
} from "./academic";
import { InvoiceDocument, type InvoicePdfData } from "./invoice";
import { ReceiptDocument, type ReceiptPdfData } from "./receipt";

export {
  type CourseResultRow,
  GradeReportDocument,
  type GradeReportPdfData,
  type StudentHeading,
  TranscriptDocument,
  type TranscriptPdfData,
} from "./academic";
export { DocumentFooter } from "./document-footer";
export { documentNumber } from "./format";
export { InvoiceDocument, type InvoicePdfData } from "./invoice";
export { Letterhead, type LetterheadData } from "./letterhead";
export { ReceiptDocument, type ReceiptPdfData } from "./receipt";

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
