import { EmptyState } from "@corex/ui/components/empty-state";
import { Construction } from "lucide-react";

/** Placeholder for sections not built yet. */
export function PendingSection({ section }: { section: string }) {
  return (
    <EmptyState
      icon={<Construction />}
      title={`${section} is not built yet`}
      description="This screen arrives in Phase 8 of the build. The layout, navigation and status bar around it are the shared Corex app shell."
    />
  );
}
