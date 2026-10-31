import { Badge } from "@corex/ui/components/badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus, invoiceStatusBadge } from "@/lib/invoices";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={invoiceStatusBadge(status)}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
