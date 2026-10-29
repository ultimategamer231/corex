import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Invoices and receipts" };

export default function InvoicesPage() {
  return (
    <ComingSoon
      title="Invoices and receipts"
      description="Invoices, payments and receipts will be created and downloaded here."
    />
  );
}
