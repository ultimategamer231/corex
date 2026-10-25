import { notFound, redirect } from "next/navigation";
import { signedPatientFileUrl } from "@/lib/files";
import { isUuid } from "@/lib/ids";
import { CLINICAL } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

/** Opens a patient attachment through a 10-minute signed link (CLN-06). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { supabase } = await requireRoles(CLINICAL);
  const { id, fileId } = await params;
  if (!isUuid(id) || !isUuid(fileId)) notFound();
  const url = await signedPatientFileUrl(supabase, id, fileId);
  if (!url) notFound();
  redirect(url);
}
