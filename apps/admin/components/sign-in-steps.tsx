import { cn } from "@corex/ui/lib/utils";
import { Check } from "lucide-react";

/** "1 Password —— 2 Authenticator" progress above the sign-in forms. */
export function SignInSteps({ step }: { step: 1 | 2 }) {
  const steps = ["Password", "Authenticator"];
  return (
    <ol aria-label="Sign-in steps" className="flex items-center gap-3">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={cn("flex items-center gap-3", i === 0 && "flex-1")}
          >
            <span
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-bold",
                done || current
                  ? "border-primary bg-primary text-white"
                  : "border-border text-muted",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : n}
            </span>
            <span
              className={cn(
                "text-[14px] font-semibold",
                done || current ? "text-primary-dark" : "text-muted",
              )}
            >
              <span className="sr-only">Step {n}: </span>
              {label}
              {done ? <span className="sr-only"> (done)</span> : null}
            </span>
            {i === 0 ? (
              <span
                className={cn("h-0.5 grow rounded-full", step > 1 ? "bg-primary" : "bg-border")}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
