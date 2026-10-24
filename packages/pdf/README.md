# @corex/pdf

Server-side PDF documents (`@react-pdf/renderer`). Every document carries the organization letterhead from `settings`, its document number and the generation date and time in the organization's timezone (CORE-10).

| Export                         | Document                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `renderInvoicePdf(data)`       | Invoice: lines with currency in the column headers, total, paid, balance; VOID marking  |
| `renderReceiptPdf(data)`       | Receipt (A5): amount, method, reference, balance after; voided receipts show the reason |
| `Letterhead`, `DocumentFooter` | Building blocks for later documents (report card, transcript, payslip)                  |

Numbers print as `INV-000042` / `RCT-000007`. Fonts are the built-in Helvetica, so rendering needs no network.

```bash
pnpm --filter @corex/pdf test   # renders PDFs and checks their text
```
