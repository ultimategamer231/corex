import { PageHeader } from "@corex/ui/components/page-header";
import { PendingSection } from "@/components/pending-section";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <PendingSection section="Dashboard" />
    </>
  );
}
