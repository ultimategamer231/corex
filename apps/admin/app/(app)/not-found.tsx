import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { SearchX } from "lucide-react";
import Link from "next/link";

export default function AppNotFound() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Page not found</h1>
      <EmptyState
        icon={<SearchX />}
        title="This page does not exist"
        description="Use the navigation to find what you need."
        action={
          <Link href="/" className={buttonVariants({ variant: "primary" })}>
            Go to the dashboard
          </Link>
        }
      />
    </>
  );
}
