/** A PDF download (inline=false) or view in the browser. */
export function pdfResponse(pdf: Buffer, filename: string, inline = false): Response {
  const safe = filename.replace(/[^A-Za-z0-9._ -]/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
