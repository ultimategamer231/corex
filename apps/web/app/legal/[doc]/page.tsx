import { cn } from "@corex/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/layout";
import {
  type LegalBlock,
  legalDocs,
  legalOrder,
  legalUpdated,
  type LegalSlug,
} from "@/content/legal";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ doc: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return legalOrder.map((doc) => ({ doc }));
}

function getDoc(slug: string) {
  return legalOrder.includes(slug as LegalSlug)
    ? { slug: slug as LegalSlug, ...legalDocs[slug as LegalSlug] }
    : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = getDoc((await params).doc);
  return d
    ? pageMetadata({ title: d.title, description: d.description, path: `/legal/${d.slug}` })
    : {};
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return <p className="leading-relaxed text-ink-soft">{block}</p>;
  }
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-ink-soft marker:text-primary">
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default async function LegalPage({ params }: Props) {
  const doc = getDoc((await params).doc);
  if (!doc) notFound();
  return (
    <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(56px,7vw,96px)]">
      <Container className="flex flex-col gap-6">
        <Breadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Legal" }, { label: doc.title }]}
        />
        <h1 className="text-[clamp(32px,4.4vw,52px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
          {doc.title}
        </h1>
        <p className="text-sm text-muted">
          Last updated: <time dateTime={legalUpdated.iso}>{legalUpdated.label}</time>
        </p>
        <nav aria-label="Legal documents" className="flex flex-wrap gap-2">
          {legalOrder.map((slug) => (
            <Link
              key={slug}
              href={`/legal/${slug}`}
              aria-current={slug === doc.slug ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-[15px] font-semibold",
                slug === doc.slug
                  ? "border-primary bg-primary text-white"
                  : "border-border-strong hover:border-primary",
              )}
            >
              {legalDocs[slug].title}
            </Link>
          ))}
        </nav>
        <div className="grid gap-10 pt-4 lg:grid-cols-[240px_1fr]">
          <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
            <p className="mb-2 text-[13px] font-bold tracking-[0.08em] text-muted uppercase">
              On this page
            </p>
            <ol className="flex flex-col">
              {doc.sections.map((s, i) => (
                <li key={s.heading}>
                  <a
                    href={`#s${i + 1}`}
                    className="inline-flex min-h-11 items-center text-[15px] text-primary hover:underline"
                  >
                    {i + 1}. {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex max-w-[720px] flex-col gap-8">
            <p className="text-lg leading-relaxed text-ink-soft">{doc.intro}</p>
            {doc.sections.map((s, i) => (
              <section key={s.heading} id={`s${i + 1}`} className="scroll-mt-6">
                <h2 className="mb-3 text-xl font-bold">
                  {i + 1}. {s.heading}
                </h2>
                <div className="flex flex-col gap-3">
                  {s.body.map((block, j) => (
                    <Block key={j} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
