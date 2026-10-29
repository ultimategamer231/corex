import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Subscriptions" };

export default function SubscriptionsPage() {
  return (
    <ComingSoon
      title="Subscriptions"
      description="Managed-plan renewals and Handover-plan warranties will be tracked here."
    />
  );
}
