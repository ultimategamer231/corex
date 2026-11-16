import { Breadcrumb } from "@/components/breadcrumb";
import { CtaBand } from "@/components/cta-band";
import { Container, Eyebrow, Section, SectionTitle } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { about } from "@/content/about";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Corex Digital Solutions, Monrovia",
  description:
    "Corex builds management software for schools, clinics, businesses and NGOs in Liberia. Led by founders Foday Malike Kabah and Emmanuel K. Sackie.",
  path: "/about",
  absoluteTitle: true,
});

function initials(name: string) {
  const parts = name.split(" ").filter((p) => !p.endsWith("."));
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`;
}

/** Eyebrow, title and a short note to the right, used by most sections here. */
function SplitHeader({
  eyebrow,
  title,
  lead,
  id,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  id: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-10">
      <div className="flex max-w-[640px] flex-col gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        <SectionTitle id={id}>{title}</SectionTitle>
      </div>
      <p className="max-w-[420px] text-base leading-relaxed text-muted">{lead}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="dark-surface relative isolate overflow-hidden bg-primary-dark text-white">
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-36 -z-10 size-[560px] rounded-full border-[70px] border-white/[0.045]"
        />
        <Container className="grid gap-10 py-[clamp(40px,6vw,80px)] lg:grid-cols-[1.5fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-5">
            <Breadcrumb tone="dark" items={[{ label: "Home", href: "/" }, { label: "About" }]} />
            <Eyebrow className="text-on-dark">{about.eyebrow}</Eyebrow>
            <h1 className="rise-in text-[clamp(34px,4.4vw,54px)] leading-[1.06] font-extrabold tracking-[-0.03em] text-white">
              {about.title}
            </h1>
            <p className="max-w-[560px] text-lg leading-relaxed text-on-dark">{about.intro}</p>
          </div>
          <div className="self-center border-t border-white/20 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-9">
            <p className="text-xs font-bold tracking-[0.14em] text-on-dark uppercase">Our focus</p>
            <ul>
              {about.focus.map((line) => (
                <li
                  key={line}
                  className="border-b border-white/15 py-3 font-display text-[clamp(22px,2vw,26px)] font-bold last:border-b-0"
                >
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-on-dark">
              {site.address.city}, {site.address.country}
            </p>
          </div>
        </Container>
      </section>

      {/* 2. Our beginnings */}
      <Section aria-labelledby="beginnings-title">
        <Container className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-4">
            <Eyebrow>{about.beginnings.eyebrow}</Eyebrow>
            <SectionTitle id="beginnings-title">{about.beginnings.title}</SectionTitle>
            <div className="mt-2 flex flex-col gap-4">
              {about.beginnings.paragraphs.map((p) => (
                <p key={p} className="text-[17px] leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
            </div>
          </div>
          <aside aria-labelledby="shaped-title" className="lg:border-l lg:border-border lg:pl-8">
            <h3 id="shaped-title" className="mb-2 font-bold">
              {about.beginnings.shapedTitle}
            </h3>
            <ul>
              {about.beginnings.shaped.map((item, i) => (
                <Reveal
                  as="li"
                  key={item.title}
                  delay={i * 0.06}
                  className="flex flex-col gap-1 border-t border-border py-4"
                >
                  <span className="text-sm font-bold text-primary">{item.title}</span>
                  <span className="text-sm leading-relaxed text-muted">{item.text}</span>
                </Reveal>
              ))}
            </ul>
          </aside>
        </Container>
      </Section>

      {/* 3. Purpose */}
      <section aria-label={about.purpose.eyebrow} className="border-y border-border bg-surface">
        <Container className="grid items-center gap-6 py-[clamp(40px,5vw,56px)] md:grid-cols-[1fr_3fr] md:gap-8">
          <Eyebrow>{about.purpose.eyebrow}</Eyebrow>
          <Reveal>
            <blockquote className="border-l-4 border-accent pl-6 font-display text-[clamp(21px,2.2vw,28px)] leading-snug font-bold">
              {about.purpose.text}
            </blockquote>
          </Reveal>
        </Container>
      </section>

      {/* 4. How we work */}
      <Section aria-labelledby="approach-title">
        <Container className="flex flex-col gap-10">
          <SplitHeader
            id="approach-title"
            eyebrow={about.approach.eyebrow}
            title={about.approach.title}
            lead={about.approach.lead}
          />
          <ol className="grid border-y border-border md:grid-cols-3">
            {about.approach.items.map((item, i) => (
              <Reveal
                as="li"
                key={item.title}
                delay={i * 0.08}
                className="flex flex-col gap-2 border-border py-7 max-md:not-first:border-t md:pr-7 md:not-first:border-l md:not-first:pl-7"
              >
                <span className="text-sm font-extrabold text-notice-icon" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")} /
                </span>
                <h3 className="text-[19px] font-bold">{item.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{item.text}</p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* 5. Selected work */}
      <Section tone="surface" aria-labelledby="work-title">
        <Container className="flex flex-col gap-8">
          <SplitHeader
            id="work-title"
            eyebrow={about.work.eyebrow}
            title={about.work.title}
            lead={about.work.lead}
          />
          <ul className="border-t border-border">
            {about.work.items.map((item, i) => (
              <Reveal
                as="li"
                key={item.name}
                delay={i * 0.06}
                className="grid gap-1 border-b border-border py-5 md:grid-cols-[1fr_1fr_1.6fr] md:items-center md:gap-6"
              >
                <span className="font-display text-[19px] font-bold">{item.name}</span>
                <span className="font-semibold text-ink-soft">{item.client}</span>
                <span className="text-[15px] leading-relaxed text-muted">{item.text}</span>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 6. Leadership and facts */}
      <Section aria-labelledby="team-title">
        <Container className="flex flex-col gap-10">
          <SplitHeader
            id="team-title"
            eyebrow={about.team.eyebrow}
            title={about.team.title}
            lead={about.team.lead}
          />
          <ul className="grid gap-6 md:grid-cols-2">
            {about.team.members.map((m, i) => (
              <Reveal
                as="li"
                key={m.name}
                delay={i * 0.08}
                className="lift flex flex-col gap-5 rounded-2xl border border-border p-7 sm:flex-row"
              >
                <span
                  className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-tint font-display text-[22px] font-extrabold text-primary"
                  aria-hidden="true"
                >
                  {initials(m.name)}
                </span>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-extrabold tracking-[0.08em] text-notice-icon uppercase">
                    {m.role}
                  </p>
                  <h3 className="text-[21px] font-bold">{m.name}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{m.bio}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <dl className="mt-4 grid gap-6 md:grid-cols-3">
            {about.facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-1 rounded-2xl bg-surface p-6">
                <dt className="text-xs font-bold tracking-[0.08em] text-primary uppercase">
                  {f.label}
                </dt>
                <dd className="font-display text-[19px] font-bold">{f.value}</dd>
                <dd className="text-sm leading-relaxed text-muted">{f.text}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <CtaBand
        title={about.cta.title}
        lead={about.cta.lead}
        primary={{ label: "Try a live demo", href: "/software" }}
        secondary={{ label: "Contact us", href: "/contact" }}
      />
    </>
  );
}
