"use client";

import { Button } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { TriangleAlert } from "lucide-react";

/** Error state for every page (CORE-09): plain words and a way to retry. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={<TriangleAlert />}
      title="Something went wrong"
      description="This page could not be loaded. Check your connection and try again. If it keeps happening, tell the school administrator."
      action={
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
