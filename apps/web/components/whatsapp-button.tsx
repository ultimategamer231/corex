import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/contact";

/** A WhatsApp shortcut that stays in the corner of every page (most clients prefer WhatsApp). */
export function WhatsAppButton() {
  return (
    <a
      href={whatsappLink("Hello Corex")}
      target="_blank"
      rel="noopener noreferrer"
      className="lift fixed right-4 bottom-4 z-30 inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-primary px-4 font-semibold text-white shadow-[0_12px_28px_-10px_rgb(6_70_68/0.7)] hover:bg-primary-dark sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp us</span>
      <span className="sr-only sm:hidden">Message us on WhatsApp</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
