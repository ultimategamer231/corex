import { PageHeader } from "@corex/ui/components/page-header";
import { Stat } from "@corex/ui/components/stat";
import type { Metadata } from "next";
import Link from "next/link";
import { currentTerm, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";

export const metadata: Metadata = { title: "Academics" };

async function count(q: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count: n, error } = await q;
  if (error) throw new Error(error.message);
  return n ?? 0;
}

export default async function AcademicsPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  const term = await currentTerm(supabase);
  const [departments, programs, courses, offerings, grades] = await Promise.all([
    count(supabase.from("departments").select("id", { count: "exact", head: true })),
    count(supabase.from("programs").select("id", { count: "exact", head: true })),
    count(supabase.from("courses").select("id", { count: "exact", head: true })),
    term
      ? count(
          supabase
            .from("course_offerings")
            .select("id", { count: "exact", head: true })
            .eq("term_id", term.id),
        )
      : 0,
    count(supabase.from("grade_scale").select("id", { count: "exact", head: true })),
  ]);
  const items = [
    {
      href: "/academics/calendar",
      label: "Current term",
      value: term ? termLabel(term) : "Not set",
    },
    { href: "/academics/departments", label: "Departments", value: departments },
    { href: "/academics/programs", label: "Programs", value: programs },
    { href: "/academics/courses", label: "Courses", value: courses },
    { href: "/academics/offerings", label: "Offerings this term", value: offerings },
    { href: "/academics/grade-scale", label: "Grades in the scale", value: grades },
  ];
  return (
    <>
      <PageHeader
        title="Academics"
        description="Calendar, programs, courses, offerings and the grade scale."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <Stat
            key={i.href}
            label={i.label}
            value={i.value}
            detail={
              <Link
                className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                href={i.href}
              >
                Manage
                <span className="sr-only"> {i.label.toLowerCase()}</span>
              </Link>
            }
          />
        ))}
      </div>
    </>
  );
}
