"use client";

import { Button, buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Download, Link2, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { FormDialog } from "@/components/form-dialog";
import { createLink, emailInvoice } from "@/app/(app)/invoices/actions";

/** The WhatsApp text with amount, due date and the client view link (SPEC-ADMIN.md 9.6). */
export function whatsappText(p: {
  contact: string | null;
  number: string;
  company: string;
  amount: string;
  due: string;
  link: string;
}): string {
  return [
    `Hello${p.contact ? ` ${p.contact}` : ""},`,
    `Here is invoice ${p.number} from ${p.company} for ${p.amount}, due ${p.due}.`,
    `View it and download the PDF here (valid 30 days): ${p.link}`,
    "Thank you.",
  ].join("\n");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {label}
      </Button>
      <span role="status" className="text-sm text-muted">
        {copied ? "Copied." : ""}
      </span>
    </span>
  );
}

/**
 * Download, client view link, Copy for WhatsApp and email for one invoice. A link is
 * shown once, when it is made (only its hash is kept); making a new one ends the old.
 */
export function ShareInvoice({
  invoiceId,
  sent,
  number,
  company,
  contact,
  amount,
  due,
  linkExpires,
  emailEnabled,
  defaultEmail,
}: {
  invoiceId: string;
  sent: boolean;
  number: string;
  company: string;
  contact: string | null;
  amount: string;
  due: string;
  linkExpires: string | null;
  emailEnabled: boolean;
  defaultEmail: string;
}) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/invoices/${invoiceId}/pdf`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Download aria-hidden="true" />
          Download PDF
        </a>
        {sent ? (
          emailEnabled ? (
            <FormDialog
              action={emailInvoice}
              triggerLabel="Email"
              triggerIcon={<Mail aria-hidden="true" />}
              title={`Email invoice ${number}`}
              description="The PDF is attached, with a new client view link (any older link stops working)."
              submitLabel="Send email"
            >
              <input type="hidden" name="invoiceId" value={invoiceId} />
              <FormField name="to" label="To" required>
                <Input type="email" defaultValue={defaultEmail} />
              </FormField>
            </FormDialog>
          ) : (
            <span className="flex flex-col gap-1">
              <Button variant="secondary" size="sm" disabled aria-describedby="email-off">
                <Mail aria-hidden="true" />
                Email
              </Button>
              <span id="email-off" className="max-w-56 text-xs text-muted">
                Verify the sending domain in Settings to email clients.
              </span>
            </span>
          )
        ) : null}
      </div>

      {sent ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <p className="text-sm text-ink-soft">
            {linkExpires
              ? `A client view link exists until ${linkExpires}. Create a new one to copy it again; the old one stops working.`
              : "No client view link yet. It shows the client only this invoice, valid 30 days."}
          </p>
          <ActionForm
            action={createLink}
            resetOnSuccess={false}
            aria-label="Client view link"
            onSuccess={(state) => setLink(state.data?.link ?? null)}
          >
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <div>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Creating...">
                <Link2 aria-hidden="true" />
                {linkExpires ? "New client view link" : "Create client view link"}
              </SubmitButton>
            </div>
          </ActionForm>
          {link ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="client-link" className="text-sm font-semibold text-ink">
                Client view link
              </label>
              <input
                id="client-link"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-11 w-full rounded-lg border border-border-strong bg-surface px-3 font-mono text-sm text-ink"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton text={link} label="Copy link" />
                <CopyButton
                  text={whatsappText({ contact, number, company, amount, due, link })}
                  label="Copy for WhatsApp"
                />
              </div>
              <p className="flex items-center gap-2 text-xs text-muted">
                <MessageCircle aria-hidden="true" className="size-4" />
                Paste the message into WhatsApp. No message is sent automatically.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
