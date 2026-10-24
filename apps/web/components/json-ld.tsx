/** Structured data for search engines (Organization, SoftwareApplication). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // JSON.stringify output with "<" escaped cannot close the script element.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
