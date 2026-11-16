// /llms.txt: a plain summary of Corex for AI assistants and AI search (llmstxt.org).
// Built from the same content files as the website, so it never drifts from the pages.
import { about } from "@/content/about";
import { home } from "@/content/home";
import { formatUsd, prices } from "@/content/pricing";
import { productOrder, products } from "@/content/products";
import { serviceOrder, services } from "@/content/services";
import { site } from "@/content/site";
import { formatPhone } from "@/lib/contact";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export function GET() {
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${site.name} (Corex) is a software company in ${site.address.city}, ${site.address.country}. It builds management systems for schools, colleges, clinics, businesses and NGOs, lets every client test a working demo with sample data before paying, then sets the system up, moves data in, trains staff and supports it locally. Key tasks keep working offline, and payments can be recorded in US dollars and Liberian dollars.`,
    "",
    "## Software",
    ...productOrder.map(
      (slug) =>
        `- [${products[slug].name}](${absoluteUrl(`/software/${slug}`)}): ${products[slug].tagline}`,
    ),
    `- [Custom software](${absoluteUrl("/software/on-request")}): systems built on request, such as point of sale, pharmacy, church, hotel and payroll.`,
    "",
    "## Services",
    ...serviceOrder.map(
      (slug) =>
        `- [${services[slug].name}](${absoluteUrl(`/services/${slug}`)}): ${services[slug].tagline}`,
    ),
    "",
    "## Pricing (starting prices, US dollars)",
    `Two plans: Managed (Corex hosts it, first-year fee then a yearly renewal) or Handover (one-time fee, the client hosts it). Details: ${absoluteUrl("/pricing")}`,
    ...prices.map(
      (p) =>
        `- ${p.name}: Managed ${formatUsd(p.managedFirstYear)} first year, then ${formatUsd(p.managedRenewal)} a year; Handover ${formatUsd(p.handover)} once.`,
    ),
    "",
    "## Company",
    `- [About](${absoluteUrl("/about")}): ${about.intro}`,
    ...about.team.members.map((m) => `- ${m.name}, ${m.role}: ${m.bio}`),
    "",
    "## Contact",
    `- Email: ${site.email.address}`,
    ...site.phones.map(
      (p, i) => `- ${i === 0 ? "Phone and WhatsApp" : "Phone"}: ${formatPhone(p)}`,
    ),
    `- Office: ${site.address.street}, ${site.address.city}, ${site.address.country}`,
    `- [Request a quote](${absoluteUrl("/contact")})`,
    "",
    "## Frequently asked questions",
    ...home.faq.items.flatMap((f) => [`### ${f.q}`, f.a, ""]),
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
