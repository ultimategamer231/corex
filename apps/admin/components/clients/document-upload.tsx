"use client";

import { Alert } from "@corex/ui/components/alert";
import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { toast } from "@corex/ui/components/sonner";
import { createClient } from "@supabase/supabase-js";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { finishDocumentUpload, startDocumentUpload } from "@/app/(app)/clients/actions";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/clients";
import { adminEnv } from "@/lib/env";
import { idleState } from "@/lib/form-state";

/**
 * Uploads a PDF, JPG or PNG (up to 10 MB) to the client's documents. The server records
 * the document and hands out a one-time link; the browser sends the file straight to
 * the private bucket (too large to pass through the app), then the server checks it.
 */
export function DocumentUpload({ clientId }: { clientId: string }) {
  const router = useRouter();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a file first.");
    if (!(file.type in DOCUMENT_TYPES)) return setError("Upload a PDF, JPG or PNG file.");
    if (file.size > MAX_DOCUMENT_BYTES) return setError("Use a file of at most 10 MB.");
    setBusy(true);
    try {
      const start = new FormData();
      start.set("clientId", clientId);
      start.set("name", file.name.slice(0, 200));
      start.set("size", String(file.size));
      start.set("type", file.type);
      const started = await startDocumentUpload(idleState, start);
      const { documentId, path, token } = started.data ?? {};
      if (started.status !== "success" || !documentId || !path || !token) {
        throw new Error(started.message ?? "The upload could not start. Try again.");
      }
      const env = adminEnv();
      const storage = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).storage.from(env.schema);
      const sent = await storage.uploadToSignedUrl(path, token, file, { contentType: file.type });
      const finish = new FormData();
      finish.set("clientId", clientId);
      finish.set("documentId", documentId);
      const finished = await finishDocumentUpload(idleState, finish);
      if (sent.error || finished.status !== "success") {
        throw new Error(finished.message ?? "The file did not arrive complete. Upload it again.");
      }
      toast.success("Document uploaded.");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong p-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Add a document</Label>
        <Input
          id={inputId}
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          aria-describedby={`${inputId}-hint`}
        />
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          PDF, JPG or PNG, up to 10 MB. Files are private; downloads use links that expire after 10
          minutes.
        </p>
      </div>
      <div>
        <Button variant="primary" onClick={() => void upload()} disabled={busy}>
          <Upload aria-hidden="true" />
          {busy ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </div>
  );
}
