import type * as React from "react";
import { SubNav } from "@/components/sub-nav";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

/** Payroll is for the Owner and Accountant only (FIN-07). */
export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  await requireRoles(MANAGER);
  return (
    <>
      <SubNav
        label="Payroll"
        items={[
          { href: "/payroll", label: "Payroll runs" },
          { href: "/payroll/employees", label: "Employees" },
          { href: "/payroll/components", label: "Pay components" },
        ]}
      />
      {children}
    </>
  );
}
