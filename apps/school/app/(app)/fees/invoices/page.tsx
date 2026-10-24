import { Button } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { pageFrom } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { InvoiceTable } from "@/components/invoice-table";
import { personName } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { BURSAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices" };

const STATUSES = ["issued", "partially_paid", "paid", "void"] as const;

type Props = { searchParams: Promise<{ student?: string; status?: string; page?: string }> };

export default async function InvoicesPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(BURSAR);
  const params = await searchParams;
  const studentId = isUuid(params.student) ? params.student : undefined;
  const status = STATUSES.find((s) => s === params.status);
  const page = pageFrom(params.page);
  const student = studentId
    ? (
        await supabase
          .from("students")
          .select("first_name, middle_name, last_name, student_number")
          .eq("id", studentId)
          .maybeSingle()
      ).data
    : null;
  const hrefFor = (p: number) =>
    `/fees/invoices?${new URLSearchParams({ ...(studentId ? { student: studentId } : {}), ...(status ? { status } : {}), page: String(p) }).toString()}`;
  return (
    <>
      <PageHeader
        title="Invoices"
        description={
          student
            ? `${personName(student)} · ${student.student_number}`
            : "All student fee invoices"
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-3" aria-label="Filter invoices">
        {studentId ? <input type="hidden" name="student" value={studentId} /> : null}
        <div className="flex w-52 flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <InvoiceTable
        db={supabase}
        studentId={studentId}
        status={status}
        page={page}
        hrefFor={hrefFor}
        empty={
          <EmptyState
            icon={<Wallet />}
            title="No invoices"
            description="Issue term invoices from the Fees overview."
          />
        }
      />
    </>
  );
}
