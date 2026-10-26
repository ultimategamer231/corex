/**
 * Company details used across the website (SPEC.md 6.6). Phone numbers are E.164
 * digits; format them with `formatPhone`.
 */
export const site = {
  name: "Corex Digital Solutions",
  shortName: "Corex",
  tagline: "Business software you can test before you pay",
  description:
    "Business software for schools, clinics, businesses and NGOs in Liberia. Log in to a live demo with sample data before you pay.",
  whatsapp: {
    /** Primary WhatsApp number for wa.me links. */
    primary: "231770021026",
  },
  /** Numbers for calls or WhatsApp, primary first. */
  phones: ["231770021026", "231775178905", "231777352002"],
  /** Owner's address until the company domain is bought (PROGRESS.md); switch then. */
  email: { address: "agamer0297@gmail.com", isPlaceholder: false },
  address: {
    street: "Carey & Johnson Street",
    city: "Monrovia",
    country: "Liberia",
  },
  /** Social profiles; the footer shows only the ones that are set (SPEC.md 6.2). */
  social: [] as { label: string; href: string }[],
  foundedYear: 2026,
} as const;
