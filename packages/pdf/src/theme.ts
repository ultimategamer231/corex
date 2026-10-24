// PDF styling: Corex tokens, built-in Helvetica (no font downloads at render time).
export const pdfColors = {
  primary: "#0B6A67",
  primaryDark: "#064644",
  ink: "#0F1F1E",
  muted: "#5B6B6A",
  border: "#D9E3E2",
  tint: "#E6F2F1",
  danger: "#B42318",
} as const;

export const pdfFonts = { body: "Helvetica", bold: "Helvetica-Bold" } as const;
