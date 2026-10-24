// @vitest-environment node
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "./xlsx";

/** Reads the files of a zip made by buildXlsx (local headers, deflate). */
function unzip(buffer: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  let at = 0;
  while (buffer.readUInt32LE(at) === 0x04034b50) {
    const size = buffer.readUInt32LE(at + 18);
    const nameLength = buffer.readUInt16LE(at + 26);
    const name = buffer.toString("utf8", at + 30, at + 30 + nameLength);
    const start = at + 30 + nameLength;
    out.set(name, inflateRawSync(buffer.subarray(start, start + size)).toString("utf8"));
    at = start + size;
  }
  return out;
}

describe("xlsx writer", () => {
  const file = buildXlsx({
    name: "Summary",
    heading: ["Income & expense summary", "Oct 2026"],
    columns: ["Month", "Income"],
    rows: [["2026-10", { value: 1250.5, currency: "USD" }]],
    total: ["Total", { value: 1250.5, currency: "USD" }],
  });

  it("is a zip with the workbook parts", () => {
    const files = unzip(file);
    expect([...files.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("writes numbers as numbers with a currency format and escapes text", () => {
    const sheet = unzip(file).get("xl/worksheets/sheet1.xml") ?? "";
    expect(sheet).toContain("Income &amp; expense summary");
    expect(sheet).toContain('<c r="B5" s="2"><v>1250.5</v></c>');
    expect(sheet).toContain('<c r="B6" s="3"><v>1250.5</v></c>');
  });
});
