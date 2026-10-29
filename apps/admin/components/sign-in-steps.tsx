import { cn } from "@corex/ui/lib/utils";

/** "1. Password  2. Authenticator code" progress above the sign-in forms. */
export function SignInSteps({ step }: { step: 1 | 2 }) {
  const steps = ["1. Password", "2. Authenticator code"];
  return (
    <ol aria-label="Sign-in steps" className="flex gap-2">
      {steps.map((label, i) => {
        const done = i + 1 <= step;
        return (
          <li
            key={label}
            aria-current={i + 1 === step ? "step" : undefined}
            className="flex flex-1 flex-col gap-1.5"
          >
            <span className={cn("h-1 rounded-full", done ? "bg-primary" : "bg-border")} />
            <span
              className={cn("text-[13px] font-semibold", done ? "text-primary-dark" : "text-muted")}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
