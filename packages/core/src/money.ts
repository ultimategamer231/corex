// Money as bigint minor units plus a currency (CORE-04). No floating point anywhere:
// amounts are parsed from strings and multiplied with integer arithmetic.

export const CURRENCIES = ["USD", "LRD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Money = { amountMinor: bigint; currency: Currency };

const SYMBOL: Record<Currency, string> = { USD: "US$", LRD: "L$" };

export class MoneyError extends Error {
  override name = "MoneyError";
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function money(amountMinor: bigint | number, currency: Currency): Money {
  if (typeof amountMinor === "number" && !Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(`Minor units must be a whole number, received ${amountMinor}`);
  }
  return { amountMinor: BigInt(amountMinor), currency };
}

/**
 * Parses a typed amount such as "1,234.5" or "1234.50" into minor units. Accepts at
 * most two decimals; rejects anything else instead of guessing.
 */
export function parseMajor(input: string, currency: Currency): Money {
  const cleaned = input
    .trim()
    .replaceAll(",", "")
    .replace(/^(US\$|L\$|\$)/, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new MoneyError(`"${input}" is not an amount with at most two decimals`);
  const [, sign, whole = "0", fraction = ""] = match;
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return { amountMinor: sign ? -minor : minor, currency };
}

/** "US$1,234.50" / "L$15,000.00"; negative amounts as "-US$5.00". */
export function formatMoney(value: Money): string {
  const negative = value.amountMinor < 0n;
  const abs = negative ? -value.amountMinor : value.amountMinor;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${SYMBOL[value.currency]}${whole}.${fraction}`;
}

/** Adds amounts of one currency; mixing currencies is an error (CORE-05). */
export function add(...values: Money[]): Money {
  const [first] = values;
  if (!first) throw new MoneyError("Nothing to add");
  for (const value of values) {
    if (value.currency !== first.currency) {
      throw new MoneyError(
        `Cannot add ${value.currency} to ${first.currency} without an exchange rate`,
      );
    }
  }
  return {
    amountMinor: values.reduce((sum, v) => sum + v.amountMinor, 0n),
    currency: first.currency,
  };
}

/** Totals per currency, never summed across currencies (CORE-05). */
export function totalsByCurrency(values: Money[]): Partial<Record<Currency, bigint>> {
  const totals: Partial<Record<Currency, bigint>> = {};
  for (const value of values)
    totals[value.currency] = (totals[value.currency] ?? 0n) + value.amountMinor;
  return totals;
}

/** Splits a decimal string ("12.5", "0.000125") into an integer and a power of ten. */
function decimal(value: string): { units: bigint; scale: bigint } {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new MoneyError(`"${value}" is not a positive decimal number`);
  const fraction = match[2] ?? "";
  return { units: BigInt(`${match[1]}${fraction}`), scale: 10n ** BigInt(fraction.length) };
}

/** numerator / denominator rounded half away from zero, like Postgres round(numeric). */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const rounded = (n * 2n + d) / (d * 2n);
  return negative ? -rounded : rounded;
}

/**
 * Line amount = quantity x unit price, rounded half away from zero to the minor
 * unit (D16). Matches the invoice_lines trigger in the database.
 */
export function lineAmount(quantity: string, unit: Money): Money {
  const q = decimal(quantity);
  return {
    amountMinor: divideRounded(q.units * unit.amountMinor, q.scale),
    currency: unit.currency,
  };
}

/**
 * Converts with an explicit, saved exchange rate (units of `to` per one unit of the
 * source currency). Callers store the rate with the record so reports never change
 * when rates change later (FIN-03).
 */
export function convert(value: Money, rate: string, to: Currency): Money {
  if (value.currency === to) return value;
  const r = decimal(rate);
  if (r.units === 0n) throw new MoneyError("Exchange rate must be greater than zero");
  return { amountMinor: divideRounded(value.amountMinor * r.units, r.scale), currency: to };
}
