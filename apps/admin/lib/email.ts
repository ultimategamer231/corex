import type { AdminDb } from "./supabase";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  template: string;
  entityType?: string;
  entityId?: string;
  /**
   * "team" emails go to admins (password resets). "client" emails stay off until the
   * sending domain is verified (CLIENT_EMAIL_ENABLED, SPEC-ADMIN.md 9.6).
   */
  audience: "team" | "client";
  /** Files to attach, for example the invoice PDF. */
  attachments?: { filename: string; content: Buffer }[];
};

export type EmailStatus = "sent" | "failed" | "skipped_disabled";

const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => escapes[c] ?? c);
}

/** A plain, accessible HTML email: a heading, paragraphs and one button link. */
export function simpleEmailHtml(
  heading: string,
  paragraphs: string[],
  link?: { label: string; url: string },
) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join("");
  const button = link
    ? `<p style="margin:24px 0"><a href="${escapeHtml(link.url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0b6a67;color:#ffffff;font-weight:700;text-decoration:none">${escapeHtml(link.label)}</a></p><p style="margin:0 0 16px;font-size:13px;color:#5b6b6a">Or copy this link: ${escapeHtml(link.url)}</p>`
    : "";
  return `<!doctype html><html lang="en"><body style="margin:0;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f1f1e"><h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>${body}${button}<p style="margin:24px 0 0;font-size:13px;color:#5b6b6a">Corex Admin</p></body></html>`;
}

/**
 * Sends through Resend and records the attempt in email_log (SPEC-ADMIN.md 9.6).
 * Without RESEND_API_KEY and EMAIL_FROM, development prints the message to the server
 * console instead; production records a failure.
 */
export async function sendEmail(service: AdminDb, message: EmailMessage): Promise<EmailStatus> {
  let status: EmailStatus;
  let resendId: string | null = null;
  let error: string | null = null;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (message.audience === "client" && process.env.CLIENT_EMAIL_ENABLED !== "true") {
    status = "skipped_disabled";
  } else if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      process.stdout.write(
        `\n[email not sent: RESEND_API_KEY or EMAIL_FROM missing]\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n\n`,
      );
      status = "skipped_disabled";
    } else {
      status = "failed";
      error = "Email is not configured (RESEND_API_KEY, EMAIL_FROM).";
    }
  } else {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.attachments?.length
            ? {
                attachments: message.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content.toString("base64"),
                })),
              }
            : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
      if (response.ok) {
        status = "sent";
        resendId = body.id ?? null;
      } else {
        status = "failed";
        error = body.message ?? `Resend answered ${response.status}`;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : "Network error";
    }
  }

  await service.from("email_log").insert({
    to_address: message.to,
    subject: message.subject,
    template: message.template,
    entity_type: message.entityType ?? null,
    entity_id: message.entityId ?? null,
    resend_id: resendId,
    status,
    error,
  });
  return status;
}
