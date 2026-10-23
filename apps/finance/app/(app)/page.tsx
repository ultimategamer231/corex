import { PageHeader } from "@/components/page-header";
import { PendingSection } from "@/components/pending-section";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Overview" />
      <PendingSection section="Overview" />
    </>
  );
}
