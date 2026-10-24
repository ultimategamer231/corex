import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { edition } from "@/lib/edition";
import { listTerms, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { AdmissionForm } from "./admission-form";

export const metadata: Metadata = { title: "Admit a student" };

export default async function NewStudentPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  const college = edition() === "college";
  const [programs, terms] = await Promise.all([
    college ? supabase.from("programs").select("id, code, name").order("code").then(rows) : [],
    listTerms(supabase),
  ]);
  const currentYear = terms.find((t) => t.is_current)?.academic_year_id;
  const sections =
    !college && currentYear
      ? rows(
          await supabase
            .from("sections")
            .select("id, name, grade_levels(name, sort_order)")
            .eq("academic_year_id", currentYear),
        )
          .sort(
            (a, b) =>
              (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
              a.name.localeCompare(b.name),
          )
          .map((s) => ({ id: s.id, label: `${s.grade_levels?.name ?? ""} ${s.name}` }))
      : undefined;
  const ready = college ? programs.length > 0 && terms.length > 0 : (sections?.length ?? 0) > 0;
  return (
    <>
      <PageHeader
        title="Admit a student"
        description="A student number is generated when you save."
      />
      {!ready ? (
        <EmptyState
          icon={<BookOpen />}
          title={college ? "Set up programs and terms first" : "Set up this year's sections first"}
          description={
            <p>
              {college
                ? "Admission enrolls the student in a program from a start term."
                : "Admission places the student in a grade and section for the current year."}{" "}
              Add them under{" "}
              <Link className="font-semibold text-primary underline" href="/academics">
                Academics
              </Link>
              .
            </p>
          }
        />
      ) : (
        <AdmissionForm
          sections={sections}
          programs={programs.map((p) => ({ id: p.id, label: `${p.code} ${p.name}` }))}
          terms={terms.map((t) => ({ id: t.id, label: termLabel(t) }))}
          defaultTerm={terms.find((t) => t.is_current)?.id}
        />
      )}
    </>
  );
}
