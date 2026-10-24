import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { CtaBand } from "@/components/cta-band";
import { Container } from "@/components/layout";
import { pageMetadata } from "@/lib/seo";
import { allWork } from "@/lib/work";
import { WorkList } from "./work-list";

export const metadata = pageMetadata({
  title: "Our work",
  description:
    "Websites and systems Corex has built for organizations, and concept projects that show what we can do.",
  path: "/work",
});

export default function WorkPage() {
  const items = allWork();
  // Nothing published: the page does not exist in production (SPEC.md 6.5).
  if (items.length === 0) notFound();
  return (
    <>
      <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(56px,7vw,96px)]">
        <Container className="flex flex-col gap-6">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Our work" }]} />
          <h1 className="text-[clamp(36px,4.8vw,58px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Our work
          </h1>
          <p className="max-w-[620px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
            Websites and systems we have built for organizations, and concept projects that show
            what we can do.
          </p>
          <WorkList items={items.map(({ body: _body, ...meta }) => meta)} />
        </Container>
      </section>
      <CtaBand
        title="Have a project in mind? Let's talk about it."
        primary={{ label: "Start a project", href: "/contact?product=website" }}
      />
    </>
  );
}
