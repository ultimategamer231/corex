import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listTerms, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { AdmissionForm } from "./admission-form";

export const metadata: Metadata = { title: "Admit a student" };

export default async function NewStudentPage() {
  const { supabase } = await requireRoles(REGISTRAR);
  const [programs, terms] = await Promise.all([
    supabase.from("programs").select("id, code, name").order("code").then(rows),
    listTerms(supabase),
  ]);
  return (
    <>
      <PageHeader
        title="Admit a student"
        description="A student number is generated when you save."
      />
      {programs.length === 0 || terms.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="Set up programs and terms first"
          description={
            <p>
              Admission enrolls the student in a program from a start term. Add them under{" "}
              <Link className="font-semibold text-primary underline" href="/academics">
                Academics
              </Link>
              .
            </p>
          }
        />
      ) : (
        <AdmissionForm
          programs={programs.map((p) => ({ id: p.id, label: `${p.code} ${p.name}` }))}
          terms={terms.map((t) => ({ id: t.id, label: termLabel(t) }))}
          defaultTerm={terms.find((t) => t.is_current)?.id}
        />
      )}
    </>
  );
}
