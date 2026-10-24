import type * as React from "react";

/** Centered card for sign-in pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh items-start justify-center bg-surface px-4 py-12 outline-none md:items-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-pop md:p-8">
        {children}
      </div>
    </main>
  );
}
