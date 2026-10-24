import { CorexMark } from "@corex/ui/brand";

/**
 * Heading above the sign-in form. The settings row is readable only by members,
 * so before sign-in this shows the product name (CORE-01: nothing hardcoded).
 */
export function OrgHeading() {
  return (
    <div className="flex items-center gap-3">
      <CorexMark className="size-10" />
      <p className="font-display text-lg font-bold text-primary-dark">School Management</p>
    </div>
  );
}
