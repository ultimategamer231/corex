import { randomUUID } from "node:crypto";
import { ActionError } from "./action";
import { financeEnv } from "./env";
import { getAdminSupabase } from "./supabase";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Largest receipt file; the demo allows 1 MB (SPEC.md 11.3). */
export function maxReceiptBytes(): number {
  return financeEnv().demo ? 1_000_000 : 5_000_000;
}

/**
 * Stores a receipt photo or PDF in this organization's private bucket and returns its
 * `files` id. Callers have checked the member's role; the service role writes the
 * file because storage has no per-role policies (SPEC.md 4.3.6).
 */
export async function uploadReceipt(file: File, ownerId: string, userId: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new ActionError("Attach a photo (JPG, PNG or WebP) or a PDF.");
  if (file.size > maxReceiptBytes()) {
    throw new ActionError(`The file is larger than ${maxReceiptBytes() / 1_000_000} MB.`);
  }
  const admin = getAdminSupabase();
  const path = `receipts/${randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(financeEnv().bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new ActionError("The file could not be uploaded. Try again.");
  const { data, error: rowError } = await admin
    .from("files")
    .insert({
      bucket_path: path,
      owner_table: "transactions",
      owner_id: ownerId,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select("id")
    .single();
  if (rowError) throw new ActionError("The file could not be saved. Try again.");
  return data.id;
}

/** A short-lived link to a stored file, for members who can see its record. */
export async function signedFileUrl(fileId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data } = await admin.from("files").select("bucket_path").eq("id", fileId).maybeSingle();
  if (!data) return null;
  const signed = await admin.storage
    .from(financeEnv().bucket)
    .createSignedUrl(data.bucket_path, 300);
  return signed.data?.signedUrl ?? null;
}
