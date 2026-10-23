import { site } from "@/content/site";

/** `https://wa.me/<number>?text=<message>` (SPEC.md 6.6). */
export function whatsappLink(message?: string, number: string = site.whatsapp.primary): string {
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Formats Liberian E.164 digits as `+231 770 021 026`. Other numbers get a leading `+` only. */
export function formatPhone(digits: string): string {
  const match = /^231(\d{3})(\d{3})(\d{3})$/.exec(digits);
  return match ? `+231 ${match[1]} ${match[2]} ${match[3]}` : `+${digits}`;
}

/** `tel:` link for a stored number. */
export function telLink(digits: string): string {
  return `tel:+${digits}`;
}
