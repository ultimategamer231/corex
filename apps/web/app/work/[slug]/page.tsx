import { Badge } from "@corex/ui/components/badge";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import type * as React from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { CtaBand } from "@/components/cta-band";
import { Container } from "@/components/layout";
import { pageMetadata } from "@/lib/seo";
import { allWork, workBySlug } from "@/lib/work";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  const items = allWork().map((w) => ({ slug: w.slug }));
  // Next.js needs at least one path for a static dynamic route; it 404s below.
  return items.length > 0 ? items : [{ slug: "none" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = workBySlug((await params).slug);
  return w
    ? pageMetadata({
        title: w.title,
        description: w.summary,
        path: `/work/${w.slug}`,
        noIndex: w.draft,
      })
    : {};
}

const mdxComponents = {
  h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
    <h2 className="mt-10 mb-3 text-2xl font-bold first:mt-0" {...props}>
      {children}
    </h2>
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="text-[17px] leading-relaxed text-ink-soft" {...props} />
  ),
};

export default async function WorkDetailPage({ params }: Props) {
  const work = workBySlug((await params).slug);
  if (!work) notFound();
  const all = allWork();
  const next = all[(all.findIndex((w) => w.slug === work.slug) + 1) % all.length];
  return (
    <>
      <article>
        <header className="pt-[clamp(32px,5vw,72px)] pb-8">
          <Container className="flex flex-col gap-5">
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Our work", href: "/work" },
                { label: work.title },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {work.draft ? <Badge variant="warning">Draft</Badge> : null}
              <Badge variant={work.type === "concept" ? "info" : "brand"}>
                {work.type === "concept" ? "Concept project" : "Client project"}
              </Badge>
            </div>
            <h1 className="max-w-[24ch] text-[clamp(32px,4.4vw,52px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
              {work.title}
            </h1>
            <p className="max-w-[680px] text-lg leading-relaxed text-muted">{work.summary}</p>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
              {[
                ["Client", work.client],
                ["Industry", work.industry],
                ["Year", String(work.year)],
                ["Built with", work.stack.join(", ")],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">
                    {term}
                  </dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {work.liveUrl ? (
              <a
                href={work.liveUrl}
                className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-primary hover:underline"
                rel="noopener"
              >
                Visit live site
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            ) : null}
          </Container>
        </header>
        <Container>
          <Image
            src={work.cover}
            alt={`Cover image for ${work.title}`}
            width={1600}
            height={1000}
            priority
            className="h-auto w-full rounded-3xl"
            sizes="(min-width: 1200px) 1120px, 100vw"
          />
        </Container>
        <Container className="max-w-[860px] py-[clamp(40px,6vw,72px)]">
          <MDXRemote source={work.body} components={mdxComponents} />
          {work.gallery.length > 0 ? (
            <section aria-labelledby="screens" className="mt-12">
              <h2 id="screens" className="mb-4 text-2xl font-bold">
                Screenshots
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {work.gallery.map((src, i) => (
                  <Image
                    key={src}
                    src={src}
                    alt={`Screenshot ${i + 1} of ${work.title}`}
                    width={1600}
                    height={1000}
                    className="h-auto w-full rounded-xl"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </Container>
      </article>
      <nav aria-label="More projects" className="border-t border-border">
        <Container className="flex flex-wrap items-center justify-between gap-4 py-6">
          <Link
            href="/work"
            className="inline-flex min-h-11 items-center gap-2 font-bold text-primary hover:underline"
          >
            <ArrowLeft className="size-[18px]" aria-hidden="true" />
            All projects
          </Link>
          {next && next.slug !== work.slug ? (
            <Link
              href={`/work/${next.slug}`}
              className="inline-flex min-h-11 flex-col items-end justify-center text-right"
            >
              <span className="text-[13px] text-muted">Next project</span>
              <span className="inline-flex items-center gap-2 font-bold text-primary">
                {next.title}
                <ArrowRight className="size-[18px]" aria-hidden="true" />
              </span>
            </Link>
          ) : null}
        </Container>
      </nav>
      <CtaBand
        title="Want something like this for your organization?"
        primary={{ label: "Start a project", href: "/contact?product=website" }}
      />
    </>
  );
}
