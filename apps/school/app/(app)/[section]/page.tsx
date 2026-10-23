import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PendingSection } from "@/components/pending-section";
import { nav, sections } from "@/lib/shell";

export const dynamicParams = false;

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

function labelFor(section: string) {
  return nav.find((item) => item.href === `/${section}`)?.label;
}

export async function generateMetadata({ params }: PageProps<"/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: labelFor(section) ?? "Not found" };
}

export default async function SectionPage({ params }: PageProps<"/[section]">) {
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
