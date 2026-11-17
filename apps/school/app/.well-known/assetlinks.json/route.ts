import { assetLinks } from "@/lib/assetlinks";

/** Android app links for the demo's APK (docs/apk.md); 404 until it is set up. */
export function GET() {
  const links = assetLinks(process.env);
  if (!links) return new Response("Not found.", { status: 404 });
  return Response.json(links, { headers: { "Cache-Control": "public, max-age=3600" } });
}
