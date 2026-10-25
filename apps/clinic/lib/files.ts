import { randomUUID } from "node:crypto";
import { ActionError } from "./action";
import { clinicEnv } from "./env";
import { getAdminSupabase, type ClinicDb } from "./supabase";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

/** Largest patient attachment: 10 MB, or 1 MB on the demo (CLN-06, SPEC.md 11.3). */
export function maxAttachmentBytes(): number {
  return clinicEnv().demo ? 1_000_000 : 10_000_000;
}

/**
 * Stores a patient attachment under `patients/<patient_id>/` in this organization's
 * private bucket (CLN-06). The file record is written as the signed-in member, so
 * row-level security confirms clinical access before anything is kept; the service
 * role writes only the object, since storage has no per-role policies.
 */
export async function uploadPatientFile(
  db: ClinicDb,
  file: File,
  patientId: string,
): Promise<void> {
  const ext = TYPES[file.type];
  if (!ext) throw new ActionError("Attach a PDF, JPG or PNG file.");
  if (file.size > maxAttachmentBytes()) {
    throw new ActionError(`The file is larger than ${maxAttachmentBytes() / 1_000_000} MB.`);
  }
  const id = randomUUID();
  const path = `patients/${patientId}/${id}.${ext}`;
  const { error: rowError } = await db.from("files").insert({
    id,
    bucket_path: path,
    owner_table: "patients",
    owner_id: patientId,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (rowError) throw new ActionError("You do not have permission to attach files.");
  const admin = getAdminSupabase();
  const { error } = await admin.storage
    .from(clinicEnv().bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    await admin.from("files").delete().eq("id", id);
    throw new ActionError("The file could not be uploaded. Try again.");
  }
}

/**
 * A 10-minute link to a patient file (CLN-06). The record is read as the member, so
 * only clinical staff get a link; the service role then signs the object path.
 */
export async function signedPatientFileUrl(
  db: ClinicDb,
  patientId: string,
  fileId: string,
): Promise<string | null> {
  const { data } = await db
    .from("files")
    .select("bucket_path")
    .eq("id", fileId)
    .eq("owner_table", "patients")
    .eq("owner_id", patientId)
    .maybeSingle();
  if (!data) return null;
  const signed = await getAdminSupabase()
    .storage.from(clinicEnv().bucket)
    .createSignedUrl(data.bucket_path, 600);
  return signed.data?.signedUrl ?? null;
}
