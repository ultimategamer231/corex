import { PageHeader } from "@corex/ui/components/page-header";
import { PendingSection } from "@/components/pending-section";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Today" />
      <PendingSection section="Today" />
    </>
  );
}
