import { cn } from "@corex/ui/lib/utils";
import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/layout";
import { legalDocs, legalOrder, type LegalSlug } from "@/content/legal";
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
  // Drafts stay out of search results and the sitemap.
  return d
    ? pageMetadata({
        title: d.title,
        description: d.intro,
        path: `/legal/${d.slug}`,
        noIndex: true,
      })
    : {};
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
        <p className="text-sm text-muted">Last updated: [date]</p>
        <p
          role="note"
          className="flex items-start gap-3 rounded-xl border border-notice-border bg-notice-subtle px-5 py-4 text-[15px] leading-relaxed text-notice"
        >
          <Info className="mt-0.5 size-5 shrink-0 text-notice-icon" aria-hidden="true" />
          <span>
            <strong>Draft.</strong> This page is a placeholder. The final text will be supplied
            after legal review.
          </span>
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
                <h2 className="mb-2 text-xl font-bold">
                  {i + 1}. {s.heading}
                </h2>
                <p className="leading-relaxed text-ink-soft">{s.summary}</p>
                <p className="mt-2 text-sm text-muted">
                  [Final wording to be supplied by counsel.]
                </p>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
