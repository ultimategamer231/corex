/**
 * Company contact details used across the website (SPEC.md 6.6).
 * Phone numbers are stored in E.164 digits; format them with `formatPhone`.
 */
export const site = {
  name: "Corex Digital Solutions",
  shortName: "Corex",
  tagline: "Business software you can test before you pay",
  whatsapp: {
    /** Primary WhatsApp number for wa.me links. */
    primary: "231770021026",
  },
  /** Numbers for calls or WhatsApp, primary first. */
  phones: ["231770021026", "231775178905", "231777352002"],
  /** Placeholder until the real address is confirmed. Do not publish as-is (PROGRESS.md). */
  email: { address: "info@cds.com", isPlaceholder: true },
  address: {
    street: "Carey & Johnson Street",
    city: "Monrovia",
    country: "Liberia",
  },
} as const;
