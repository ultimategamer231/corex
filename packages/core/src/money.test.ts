import { describe, expect, it } from "vitest";
import {
  add,
  convert,
  formatMoney,
  lineAmount,
  money,
  MoneyError,
  parseMajor,
  totalsByCurrency,
} from "./money";

describe("parseMajor", () => {
  it.each([
    ["1,234.50", 123450n],
    ["1234.5", 123450n],
    ["15000", 1500000n],
    ["0.07", 7n],
    ["US$12.30", 1230n],
    ["-5", -500n],
  ])("parses %s", (input, minor) => {
    expect(parseMajor(input, "USD").amountMinor).toBe(minor);
  });

  it.each(["", "abc", "1.234", "1.2.3", "1e3", "12,34.5x"])("rejects %s", (input) => {
    expect(() => parseMajor(input, "USD")).toThrow(MoneyError);
  });

  it("is exact where floating point is not (0.1 + 0.2)", () => {
    expect(add(parseMajor("0.10", "USD"), parseMajor("0.20", "USD")).amountMinor).toBe(30n);
  });
});

describe("formatMoney", () => {
  it("shows the currency on every amount", () => {
    expect(formatMoney(money(4821000, "USD"))).toBe("US$48,210.00");
    expect(formatMoney(money(1500000, "LRD"))).toBe("L$15,000.00");
    expect(formatMoney(money(-505, "USD"))).toBe("-US$5.05");
    expect(formatMoney(money(0, "LRD"))).toBe("L$0.00");
  });

  it("handles amounts beyond Number's safe range", () => {
    expect(formatMoney({ amountMinor: 900719925474099312n, currency: "LRD" })).toBe(
      "L$9,007,199,254,740,993.12",
    );
  });
});

describe("currency safety (CORE-05)", () => {
  it("refuses to add different currencies", () => {
    expect(() => add(money(100, "USD"), money(100, "LRD"))).toThrow(/exchange rate/);
  });

  it("totals each currency separately", () => {
    expect(totalsByCurrency([money(100, "USD"), money(250, "LRD"), money(50, "USD")])).toEqual({
      USD: 150n,
      LRD: 250n,
    });
  });

  it("converts only with an explicit rate, rounding half away from zero", () => {
    expect(convert(money(1000, "USD"), "192.5", "LRD")).toEqual(money(192500, "LRD"));
    expect(convert(money(192500, "LRD"), "0.005194805", "USD")).toEqual(money(1000, "USD"));
    expect(() => convert(money(1, "USD"), "0", "LRD")).toThrow(MoneyError);
  });
});

describe("lineAmount (matches the database trigger)", () => {
  it.each([
    ["2", 2500n, 5000n],
    ["0.5", 333n, 167n],
    ["0.5", 335n, 168n],
    ["1.25", 1999n, 2499n],
  ])("%s x %d = %d", (quantity, unit, expected) => {
    expect(lineAmount(quantity, { amountMinor: unit, currency: "USD" }).amountMinor).toBe(expected);
  });
});
