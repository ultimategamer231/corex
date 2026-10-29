"use client";

import { Button } from "@corex/ui/components/button";
import { useState } from "react";

/** A one-time link with a copy button, for passing on by WhatsApp or email. */
export function CopyLink({ link, label = "Link" }: { link: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-ink" htmlFor="one-time-link">
        {label}
      </label>
      <input
        id="one-time-link"
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 w-full rounded-lg border border-border-strong bg-surface px-3 font-mono text-sm text-ink"
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          Copy link
        </Button>
        <span role="status" className="text-sm text-muted">
          {copied ? "Copied." : ""}
        </span>
      </div>
    </div>
  );
}
