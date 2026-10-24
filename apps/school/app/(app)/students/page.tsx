import { Badge } from "@corex/ui/components/badge";
import { Button, buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { PAGE_SIZE, Pagination, pageFrom } from "@corex/ui/components/pagination";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { personName } from "@/lib/format";
import { OFFICE, REGISTRAR } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";

export const metadata: Metadata = { title: "Students" };

const STATUSES = ["active", "withdrawn", "graduated", "suspended"] as const;

type Props = { searchParams: Promise<{ q?: string; status?: string; page?: string }> };

/** Characters that would change a PostgREST filter are removed from the search text. */
function cleanSearch(q: string | undefined): string {
  return (q ?? "")
    .replace(/[,()*%\\]/g, " ")
    .trim()
    .slice(0, 80);
}

export default async function StudentsPage({ searchParams }: Props) {
  const { supabase, member } = await requireRoles(OFFICE);
  const params = await searchParams;
  const q = cleanSearch(params.q);
  const status = STATUSES.find((s) => s === params.status);
  const page = pageFrom(params.page);

  let query = supabase
    .from("students")
    .select(
      "id, student_number, first_name, middle_name, last_name, status, program_enrollments(status, programs(code))",
      {
        count: "exact",
      },
    )
    .order("last_name")
    .order("first_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q)
    query = query.or(`first_name.ilike.*${q}*,last_name.ilike.*${q}*,student_number.ilike.*${q}*`);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    sp.set("page", String(p));
    return `/students?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Students"
        description={`${count ?? 0} student${count === 1 ? "" : "s"}`}
        actions={
          memberHas(member, REGISTRAR) ? (
            <Link href="/students/new" className={buttonVariants({ variant: "accent" })}>
              <UserPlus aria-hidden="true" />
              Admit a student
            </Link>
          ) : null
        }
      />
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Find students"
      >
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">Name or student number</Label>
          <Input id="q" name="q" defaultValue={q} type="search" />
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0]?.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {data.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q || status ? "No students match" : "No students yet"}
          description={
            q || status
              ? "Try a different name, number or status."
              : "Admitted students appear here."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <TableScroll label="Students">
            <Table>
              <thead>
                <tr>
                  <Th>Student number</Th>
                  <Th>Name</Th>
                  <Th>Program</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-mono text-sm">{s.student_number}</Td>
                    <Td>
                      <Link
                        href={`/students/${s.id}`}
                        className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                      >
                        {personName(s)}
                      </Link>
                    </Td>
                    <Td>
                      {s.program_enrollments.find((e) => e.status === "active")?.programs?.code ??
                        "-"}
                    </Td>
                    <Td>
                      <Badge variant={s.status === "active" ? "brand" : "neutral"}>
                        {s.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
          <Pagination page={page} total={count ?? 0} hrefFor={hrefFor} />
        </div>
      )}
    </>
  );
}
