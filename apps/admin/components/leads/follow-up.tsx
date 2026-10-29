import { cn } from "@corex/ui/lib/utils";
import { isOverdue, relativeDay } from "@/lib/format";

/** A follow-up date. Overdue ones, and those due today or tomorrow, stand out. */
export function FollowUp({ day, className }: { day: string | null; className?: string }) {
  if (!day) return <span className={cn("text-muted", className)}>—</span>;
  const label = relativeDay(day);
  if (isOverdue(day)) {
    return <span className={cn("font-bold text-danger", className)}>Overdue, {label}</span>;
  }
  const soon = label === "Today" || label === "Tomorrow";
  return (
    <span className={cn(soon ? "font-bold text-warning" : "text-ink", className)}>{label}</span>
  );
}
