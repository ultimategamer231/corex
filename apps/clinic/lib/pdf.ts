import type { Currency, Money } from "@corex/core/money";
import { letterhead } from "./org";

/** A PDF download that is never cached (it carries personal data). */
export function pdfResponse(pdf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function toMoney(amountMinor: number | string | null | undefined, currency: string): Money {
  return { amountMinor: BigInt(amountMinor ?? 0), currency: currency as Currency };
}

export { letterhead };
