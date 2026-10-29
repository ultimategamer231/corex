import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <ComingSoon
      title="Leads"
      description="Quote requests from the website will be worked here. Until then they arrive by email."
    />
  );
}
