import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <ComingSoon
      title="Dashboard"
      description="New leads, money outstanding, renewals and what needs attention will appear here."
    />
  );
}
