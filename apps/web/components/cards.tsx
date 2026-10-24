import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import { products, type ProductSlug } from "@/content/products";
import type { WorkMeta } from "@/lib/work";
import { AppPreview } from "./app-preview";
import { CheckList } from "./check-list";

export function ProductCard({ slug }: { slug: ProductSlug }) {
  const p = products[slug];
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background">
      <div className="bg-tint px-4 pt-4">
        <AppPreview kind={slug} size="compact" />
      </div>
      <div className="flex grow flex-col gap-4 p-6">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[22px] font-bold">{p.name}</h3>
          <p className="text-sm font-medium text-muted">{p.audience}</p>
        </div>
        <CheckList items={p.cardFeatures} className="grow" />
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="accent">
            <Link href={`/software/${slug}#demo`}>
              Try demo<span className="sr-only"> of {p.name}</span>
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/software/${slug}`}>
              Learn more<span className="sr-only"> about {p.name}</span>
            </Link>
          </Button>
        </div>
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
