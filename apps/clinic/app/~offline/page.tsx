import { CorexMark } from "@corex/ui/brand";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker for pages not opened while online (SPEC.md 10.2). */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4 py-10">
      <CorexMark className="size-12" />
      <h1 className="font-display text-3xl font-bold">You are offline</h1>
      <p className="text-[17px] text-ink-soft">
        This page was not opened while you were online, so it is not on this device yet. Pages you
        opened recently still work, and the patients and vitals you save are kept on this device
        until the connection is back.
      </p>
      <p>
        <a
          href="/"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          Try again
        </a>
      </p>
    </main>
  );
}
