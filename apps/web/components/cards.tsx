import { Badge } from "@corex/ui/components/badge";
import { ArrowRight, ChartColumn, GraduationCap, Stethoscope } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { products, type ProductSlug } from "@/content/products";
import type { WorkMeta } from "@/lib/work";
import { AppPreview } from "./app-preview";

const productIcons = { school: GraduationCap, clinic: Stethoscope, finance: ChartColumn } as const;

export function ProductCard({ slug }: { slug: ProductSlug }) {
  const p = products[slug];
  const Icon = productIcons[slug];
  return (
    <article className="lift flex h-full flex-col gap-5 rounded-2xl border border-border bg-background p-6 hover:border-primary/40">
      <div className="flex items-center gap-3.5">
        <span
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-tint text-primary"
          aria-hidden="true"
        >
          <Icon className="size-6" />
        </span>
        <div className="flex flex-col">
          <h3 className="text-[20px] leading-tight font-bold">{p.name}</h3>
          <p className="text-sm text-muted">{p.audience}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-tint px-3 pt-3">
        <AppPreview kind={slug} size="compact" />
      </div>
      <p className="grow text-[15px] leading-relaxed text-ink-soft">{p.tagline}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link
          href={`/software/${slug}#demo`}
          className="nudge inline-flex min-h-11 items-center gap-1.5 font-bold text-primary hover:underline"
        >
          Try the demo<span className="sr-only"> of {p.name}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href={`/software/${slug}`}
          className="inline-flex min-h-11 items-center font-semibold text-ink-soft hover:text-primary hover:underline"
        >
          Learn more<span className="sr-only"> about {p.name}</span>
        </Link>
      </div>
    </article>
  );
}

export function WorkCard({ work, headingLevel = 3 }: { work: WorkMeta; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link
      href={`/work/${work.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background hover:border-primary"
    >
      <Image
        src={work.cover}
        alt=""
        width={1600}
        height={1000}
        className="aspect-[16/10] h-auto w-full object-cover"
        sizes="(min-width: 1024px) 380px, 100vw"
      />
      <div className="flex flex-col gap-2 px-5 pt-5 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {work.draft ? <Badge variant="warning">Draft</Badge> : null}
          {work.type === "concept" ? <Badge variant="info">Concept project</Badge> : null}
          <span className="text-[13px] text-muted">
            {work.industry} · {work.year}
          </span>
        </div>
        <Heading className="text-[19px] font-bold group-hover:underline">{work.title}</Heading>
        <p className="text-[15px] leading-relaxed text-muted">{work.summary}</p>
      </div>
    </Link>
  );
}
