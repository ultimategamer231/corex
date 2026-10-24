/** "INV-000042" / "RCT-000007": fixed-width document numbers (CORE-08). */
export function documentNumber(prefix: "INV" | "RCT", number: number | bigint): string {
  return `${prefix}-${String(number).padStart(6, "0")}`;
}
