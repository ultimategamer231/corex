import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Construction } from "lucide-react";

/** Placeholder for pages built in later blocks (SPEC-ADMIN.md 14). */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <EmptyState
        icon={<Construction />}
        title="This page is being built"
        description={description}
      />
    </div>
  );
}
