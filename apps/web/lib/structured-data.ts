// Structured data (schema.org JSON-LD) that search engines and AI assistants read to
// understand who Corex is, what it sells and where. Built from the content files only.
import { about } from "@/content/about";
import { productOrder, products } from "@/content/products";
import { serviceOrder, services } from "@/content/services";
import { site } from "@/content/site";
import { absoluteUrl, schemaIds, siteUrl } from "@/lib/seo";

const phone = (digits: string) => `+${digits}`;

/** The company and the website, on every page (app/layout.tsx). */
export function siteGraph() {
  const ids = schemaIds();
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "ProfessionalService"],
        "@id": ids.organization,
        name: site.name,
        alternateName: site.shortName,
        url: base,
        logo: absoluteUrl("/brand/corex-logo.png"),
        image: absoluteUrl("/opengraph-image"),
        description: site.description,
        slogan: site.tagline,
        email: site.email.address,
        telephone: site.phones[0] ? phone(site.phones[0]) : undefined,
        foundingDate: String(site.foundedYear),
        address: {
          "@type": "PostalAddress",
          streetAddress: site.address.street,
          addressLocality: site.address.city,
          addressCountry: "LR",
        },
        areaServed: [
          { "@type": "Country", name: "Liberia" },
          { "@type": "Place", name: "West Africa" },
        ],
        contactPoint: site.phones.map((digits, i) => ({
          "@type": "ContactPoint",
          telephone: phone(digits),
          contactType: i === 0 ? "sales" : "customer support",
          areaServed: "LR",
          availableLanguage: ["English"],
        })),
        founder: about.team.members.map((m) => ({
          "@type": "Person",
          name: m.name,
          jobTitle: m.role,
          description: m.bio,
        })),
        knowsAbout: [
          "School management software",
          "College and university management systems",
          "Clinic management software",
          "Financial and accounting software",
          "Offline-first web applications",
          "Custom software development",
          "AI automation",
          "IT consultancy",
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Software and services",
          itemListElement: [
            ...productOrder.map((slug) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "SoftwareApplication",
                name: products[slug].name,
                url: absoluteUrl(`/software/${slug}`),
              },
            })),
            ...serviceOrder.map((slug) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: services[slug].name,
                url: absoluteUrl(`/services/${slug}`),
              },
            })),
          ],
        },
        sameAs: site.social.map((s) => s.href),
      },
      {
        "@type": "WebSite",
        "@id": ids.website,
        url: base,
        name: site.name,
        description: site.description,
        inLanguage: "en",
        publisher: { "@id": ids.organization },
      },
    ],
  };
}

/** The page's place in the site, matching the visible breadcrumb. */
export function breadcrumbSchema(items: readonly { label: string; href?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}
