import { Breadcrumb } from "@/components/breadcrumb";
import { CtaBand } from "@/components/cta-band";
import { Container, Eyebrow, Section, SectionTitle } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { about } from "@/content/about";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Corex",
  description:
    "Corex Digital Solutions is a software studio in Monrovia building systems for schools, clinics, businesses and NGOs.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(48px,6vw,88px)]">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About" }]} />
            <h1 className="text-[clamp(34px,4.4vw,54px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
              {about.title}
            </h1>
          </div>
          <div className="flex flex-col gap-5 lg:pt-14">
            {about.intro.map((p) => (
              <p key={p} className="text-lg leading-relaxed text-ink-soft">
                {p}
              </p>
            ))}
          </div>
        </Container>
      </section>

      <Section tone="tint" aria-labelledby="beliefs-title">
        <Container className="flex flex-col gap-8">
          <SectionTitle id="beliefs-title">What we believe</SectionTitle>
          <ul className="grid gap-6 md:grid-cols-3">
            {about.beliefs.map((b, i) => (
              <Reveal
                as="li"
                key={b.title}
                delay={i * 0.06}
                className="flex flex-col gap-2 rounded-2xl bg-background p-6"
              >
                <h3 className="text-xl font-bold">{b.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{b.text}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section aria-labelledby="team-title">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Eyebrow>Team</Eyebrow>
            <SectionTitle id="team-title">The people behind Corex</SectionTitle>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {about.team.map((member, i) => (
              <li key={`${member.role}-${i}`} className="flex flex-col gap-3">
                <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-tint text-sm font-semibold text-muted">
                  [Photo]
                </div>
                <p className="font-display text-lg font-bold">{member.name}</p>
                <p className="-mt-2 text-[15px] text-muted">{member.role}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="surface" aria-label="Facts">
        <Container>
          <dl className="grid gap-8 md:grid-cols-3">
            {about.facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <dt className="text-[13px] font-bold tracking-[0.08em] text-primary uppercase">
                  {f.label}
                </dt>
                <dd className="font-display text-xl font-bold">{f.value}</dd>
                <dd className="text-[15px] leading-relaxed text-muted">{f.text}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <CtaBand
        title="See what we build. Try a demo."
        primary={{ label: "Try a live demo", href: "/software" }}
        secondary={{ label: "Contact us", href: "/contact" }}
      />
    </>
  );
}
