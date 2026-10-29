import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <ComingSoon
      title="Clients"
      description="Clients, contracts, deployments and documents will be kept here."
    />
  );
}
