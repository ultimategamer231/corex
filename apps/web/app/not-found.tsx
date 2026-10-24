import { Button } from "@corex/ui/components/button";
import Link from "next/link";
import { Container } from "@/components/layout";

export default function NotFound() {
  return (
    <section className="py-[clamp(64px,10vw,140px)]">
      <Container className="flex max-w-[640px] flex-col items-start gap-5">
        <p className="text-[13px] font-bold tracking-[0.08em] text-primary uppercase">
          Page not found
        </p>
        <h1 className="text-[clamp(32px,4.4vw,52px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
          We could not find that page
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          The link may be old or mistyped. Try the systems we offer, or tell us what you are looking
          for.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg">
            <Link href="/software">See our software</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Go to the home page</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
