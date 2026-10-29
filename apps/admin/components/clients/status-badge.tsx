import { Badge } from "@corex/ui/components/badge";
import { type ClientStatus, STATUS_LABELS, statusBadge } from "@/lib/clients";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge variant={statusBadge(status)}>{STATUS_LABELS[status]}</Badge>;
}
