import type { XlsxCell, XlsxSheet } from "@corex/core/xlsx";
import { money } from "./format";
import type { Cell, ReportTable } from "./reports";

/** A cell as shown on screen and in the PDF. */
export function formatCell(cell: Cell): string {
  return typeof cell === "string" ? cell : money(cell.minor, cell.currency);
}

/** A cell for Excel: money stays a number (major units) with its currency format. */
export function excelCell(cell: Cell): XlsxCell {
  if (typeof cell === "string") return cell;
  return { value: cell.minor / 100, currency: cell.currency };
}

/** The same table as the screen and the PDF, for Excel (FIN-08). */
export function toSheet(table: ReportTable, orgName: string): XlsxSheet {
  return {
    name: table.title.slice(0, 31),
    heading: [orgName, table.title, table.subtitle],
    columns: table.columns.map((c) => c.label),
    rows: table.rows.map((r) => r.map(excelCell)),
    total: table.total?.map(excelCell),
  };
}
