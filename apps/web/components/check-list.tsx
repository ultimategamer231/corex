import { cn } from "@corex/ui/lib/utils";
import { Check } from "lucide-react";

export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2.5 text-[15px] leading-normal", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <Check
            className="mt-0.5 size-[18px] shrink-0 text-primary"
            strokeWidth={2.4}
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
