import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@corex/ui/components/page-header";
import { PendingSection } from "@/components/pending-section";
import { nav, sections } from "@/lib/shell";

type SectionPageProps = { params: Promise<{ section: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

function labelFor(section: string) {
  return nav.find((item) => item.href === `/${section}`)?.label;
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  return { title: labelFor(section) ?? "Not found" };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const label = labelFor(section);
  if (!label) notFound();
  return (
    <>
      <PageHeader title={label} />
      <PendingSection section={label} />
    </>
  );
}
