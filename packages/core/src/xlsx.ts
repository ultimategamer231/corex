// Minimal Excel (.xlsx) writer for report exports (SPEC.md 9.4, 8.4): one sheet,
// text and number cells, bold totals, currency number formats. Server only (uses
// node:zlib); no dependency, since an .xlsx file is a zip of a few XML parts.
import { crc32, deflateRawSync } from "node:zlib";

export type XlsxCell =
  string | number | null | { value: number; currency: string } | { text: string; bold: true };

export type XlsxSheet = {
  name: string;
  /** Title rows above the table. */
  heading?: string[];
  columns: string[];
  rows: XlsxCell[][];
  /** Bold last row. */
  total?: XlsxCell[];
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function columnName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// Styles: 0 normal, 1 bold, then per currency a number format, normal and bold.
const CURRENCIES = ["USD", "LRD"] as const;
const moneyStyle = (currency: string, bold: boolean) => {
  const i = Math.max(0, CURRENCIES.indexOf(currency as (typeof CURRENCIES)[number]));
  return 2 + i * 2 + (bold ? 1 : 0);
};

function cellXml(ref: string, cell: XlsxCell, bold: boolean): string {
  if (cell === null || cell === "") return "";
  if (typeof cell === "number") return `<c r="${ref}"${bold ? ' s="1"' : ""}><v>${cell}</v></c>`;
  if (typeof cell === "string") {
    return `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ""}><is><t xml:space="preserve">${escape(cell)}</t></is></c>`;
  }
  if ("text" in cell) {
    return `<c r="${ref}" t="inlineStr" s="1"><is><t xml:space="preserve">${escape(cell.text)}</t></is></c>`;
  }
  return `<c r="${ref}" s="${moneyStyle(cell.currency, bold)}"><v>${cell.value}</v></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const lines: { cells: XlsxCell[]; bold: boolean }[] = [
    ...(sheet.heading ?? []).map((h, i) => ({ cells: [h], bold: i === 0 })),
    ...(sheet.heading?.length ? [{ cells: [], bold: false }] : []),
    { cells: sheet.columns, bold: true },
    ...sheet.rows.map((cells) => ({ cells, bold: false })),
    ...(sheet.total ? [{ cells: sheet.total, bold: true }] : []),
  ];
  const rows = lines
    .map(({ cells, bold }, r) => {
      const xml = cells.map((c, i) => cellXml(`${columnName(i)}${r + 1}`, c, bold)).join("");
      return `<row r="${r + 1}">${xml}</row>`;
    })
    .join("");
  const cols = sheet.columns
    .map(
      (_c, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 22 : 18}" customWidth="1"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;USD &quot;#,##0.00;&quot;USD -&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="&quot;LRD &quot;#,##0.00;&quot;LRD -&quot;#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function parts(sheet: XlsxSheet): [string, string][] {
  const name = escape(sheet.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
  return [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", sheetXml(sheet)],
  ];
}

/** A zip archive of the given files (deflate), as Excel expects. */
function zip(files: [string, string][]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content, "utf8");
    const packed = deflateRawSync(data);
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    locals.push(header, nameBytes, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += header.length + nameBytes.length + packed.length;
  }
  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

export function buildXlsx(sheet: XlsxSheet): Buffer {
  return zip(parts(sheet));
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
