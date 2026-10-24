export const INVOICE_STATUS = {
  draft: { label: "Draft", variant: "neutral" },
  issued: { label: "Unpaid", variant: "warning" },
  partially_paid: { label: "Part paid", variant: "info" },
  paid: { label: "Paid", variant: "brand" },
  void: { label: "Void", variant: "danger" },
} as const;

export type InvoiceStatus = keyof typeof INVOICE_STATUS;

export function invoiceStatus(status: string) {
  return INVOICE_STATUS[status as InvoiceStatus] ?? INVOICE_STATUS.draft;
}
