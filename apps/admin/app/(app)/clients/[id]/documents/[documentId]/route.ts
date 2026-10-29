import { z } from "zod";
import { adminEnv } from "@/lib/env";
import { AdminAuthError, requireAdmin } from "@/lib/session";

type Context = { params: Promise<{ id: string; documentId: string }> };

/** A client document through a link that expires after 10 minutes (SPEC-ADMIN.md 8.2). */
export async function GET(_request: Request, { params }: Context) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response("Please sign in.", { status: 401 });
    throw error;
  }
  const { id, documentId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(documentId).success) {
    return new Response("Not found.", { status: 404 });
  }
  // Read as the admin, so row-level security decides; only then sign the path.
  const { data } = await session.supabase
    .from("client_documents")
    .select("storage_path, name")
    .eq("id", documentId)
    .eq("client_id", id)
    .not("uploaded_at", "is", null)
    .maybeSingle();
  if (!data) return new Response("Not found.", { status: 404 });
  const signed = await session
    .service()
    .storage.from(adminEnv().schema)
    .createSignedUrl(data.storage_path, 600, { download: data.name });
  if (signed.error) return new Response("The file is not available.", { status: 404 });
  return Response.redirect(signed.data.signedUrl, 303);
}
