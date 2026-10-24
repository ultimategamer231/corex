import { cn } from "@corex/ui/lib/utils";
import type * as React from "react";

export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-[clamp(16px,4vw,40px)]", className)}
      {...props}
    />
  );
}

const tones = {
  white: "bg-background",
  surface: "border-y border-border bg-surface",
  tint: "bg-tint",
  dark: "dark-surface bg-primary-dark text-white",
} as const;

export function Section({
  tone = "white",
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & { tone?: keyof typeof tones }) {
  return (
    <section className={cn("py-[clamp(56px,7vw,96px)]", tones[tone], className)} {...props}>
      {children}
    </section>
  );
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-[13px] font-bold tracking-[0.08em] text-primary uppercase", className)}
      {...props}
    />
  );
}

export function SectionTitle({ className, children, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-[clamp(28px,3.2vw,40px)] leading-[1.15] font-bold tracking-[-0.02em] text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function Lead({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[17px] leading-relaxed text-muted", className)} {...props} />;
}

/** Eyebrow + title + optional lead, stacked (mockup section header). */
export function SectionHeader({
  eyebrow,
  title,
  lead,
  className,
  titleId,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  className?: string;
  titleId?: string;
}) {
  return (
    <div className={cn("flex max-w-[640px] flex-col gap-3", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {lead ? <Lead>{lead}</Lead> : null}
    </div>
  );
}
