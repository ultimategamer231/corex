import { Badge } from "@corex/ui/components/badge";
import { stageBadge, stageLabel } from "@/lib/leads";

export function StageBadge({ stage }: { stage: string }) {
  return <Badge variant={stageBadge(stage)}>{stageLabel(stage)}</Badge>;
}
