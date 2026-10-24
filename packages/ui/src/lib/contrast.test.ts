// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const css = readFileSync(new URL("../styles/theme.css", import.meta.url), "utf8");
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
) as Record<string, string>;

function token(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Missing token --color-${name}`);
  return value;
}

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("rejects malformed colors", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow();
  });
});

describe("SPEC.md 5.4 tokens", () => {
  it.each([
    ["primary", "#0b6a67"],
    ["primary-dark", "#064644"],
    ["accent", "#ff5a12"],
    ["accent-hover", "#e04a08"],
    ["tint", "#e6f2f1"],
    ["ink", "#0f1f1e"],
    ["muted", "#5b6b6a"],
    ["border", "#d9e3e2"],
    ["background", "#ffffff"],
  ])("%s is %s", (name, hex) => {
    expect(token(name).toLowerCase()).toBe(hex);
  });

  it("uses dark text on accent buttons (prompt amendment 2)", () => {
    expect(token("accent-foreground").toLowerCase()).toBe("#1b0a02");
  });
});

// Every text pairing used by components must reach 4.5:1 (WCAG 1.4.3).
const textPairs: [fg: string, bg: string][] = [
  ["ink", "background"],
  ["ink", "surface"],
  ["ink", "tint"],
  ["ink-soft", "surface"],
  ["ink-soft", "surface-muted"],
  ["muted", "background"],
  ["muted", "surface"],
  ["muted", "tint"],
  ["primary", "background"],
  ["primary", "surface"],
  ["primary", "tint"],
  ["primary-dark", "tint"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-dark"],
  ["accent-foreground", "accent"],
  ["accent-foreground", "accent-hover"],
  ["on-dark", "primary-dark"],
  ["on-dark-muted", "primary-dark"],
  ["on-dark-muted", "primary-darker"],
  ["white", "primary-darker"],
  ["warning", "warning-subtle"],
  ["notice", "notice-subtle"],
  ["info", "info-subtle"],
  ["danger", "background"],
  ["danger", "danger-subtle"],
  ["danger-foreground", "danger"],
];

// Control boundaries and focus rings must reach 3:1 (WCAG 1.4.11).
const uiPairs: [fg: string, bg: string][] = [
  ["border-strong", "background"],
  ["border-strong", "surface"],
  ["ring", "background"],
  ["ring", "surface"],
  ["ring", "tint"],
  ["ring-on-dark", "primary-dark"],
  ["ring-on-dark", "primary-darker"],
  // Chart marks on cards and the app surface.
  ["data-1", "background"],
  ["data-1", "surface"],
  ["data-2", "background"],
  ["data-2", "surface"],
];

describe("contrast of token pairs", () => {
  it.each(textPairs)("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)("ui %s on %s is at least 3:1", (fg, bg) => {
    expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(3);
  });
});
