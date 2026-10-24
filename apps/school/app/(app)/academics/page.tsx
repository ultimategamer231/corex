import { PageHeader } from "@corex/ui/components/page-header";
import { Stat } from "@corex/ui/components/stat";
import type { Metadata } from "next";
import Link from "next/link";
import { edition } from "@/lib/edition";
import { currentTerm, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import type { SchoolDb } from "@/lib/supabase";

export const metadata: Metadata = { title: "Academics" };

async function count(q: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count: n, error } = await q;
  if (error) throw new Error(error.message);
  return n ?? 0;
}

async function collegeItems(db: SchoolDb, termId: string | undefined) {
  const [departments, programs, courses, offerings, grades] = await Promise.all([
    count(db.from("departments").select("id", { count: "exact", head: true })),
    count(db.from("programs").select("id", { count: "exact", head: true })),
    count(db.from("courses").select("id", { count: "exact", head: true })),
    termId
      ? count(
          db
            .from("course_offerings")
            .select("id", { count: "exact", head: true })
            .eq("term_id", termId),
        )
      : 0,
    count(db.from("grade_scale").select("id", { count: "exact", head: true })),
  ]);
  return [
    { href: "/academics/departments", label: "Departments", value: departments },
    { href: "/academics/programs", label: "Programs", value: programs },
    { href: "/academics/courses", label: "Courses", value: courses },
    { href: "/academics/offerings", label: "Offerings this term", value: offerings },
    { href: "/academics/grade-scale", label: "Grades in the scale", value: grades },
  ];
}

async function highSchoolItems(
  db: SchoolDb,
  termId: string | undefined,
  yearId: string | undefined,
) {
  const [levels, sections, subjects, periods] = await Promise.all([
    count(db.from("grade_levels").select("id", { count: "exact", head: true })),
    yearId
      ? count(
          db
            .from("sections")
            .select("id", { count: "exact", head: true })
            .eq("academic_year_id", yearId),
        )
      : 0,
    count(db.from("subjects").select("id", { count: "exact", head: true })),
    termId
      ? count(
          db
            .from("marking_periods")
            .select("id", { count: "exact", head: true })
            .eq("term_id", termId),
        )
      : 0,
  ]);
  return [
    { href: "/academics/grade-levels", label: "Grade levels", value: levels },
    { href: "/academics/sections", label: "Sections this year", value: sections },
    { href: "/academics/subjects", label: "Subjects", value: subjects },
    { href: "/academics/marking-periods", label: "Marking periods this term", value: periods },
  ];
}

export default async function AcademicsPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  const term = await currentTerm(supabase);
  const rest =
    edition() === "college"
      ? await collegeItems(supabase, term?.id)
      : await highSchoolItems(supabase, term?.id, term?.academic_year_id);
  const items = [
    {
      href: "/academics/calendar",
      label: "Current term",
      value: term ? termLabel(term) : "Not set",
    },
    ...rest,
  ];
  return (
    <>
      <PageHeader
        title="Academics"
        description="Calendar, classes, subjects and how grades are recorded."
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
