import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/section";
import { loadAcademicRecord } from "@/lib/academic";
import { formatGpa } from "@/lib/gpa";
import { currentTerm, rows, termLabel } from "@/lib/queries";
import { REGISTRAR, TEACHING } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import type { SchoolDb } from "@/lib/supabase";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesPage() {
  const { supabase, member } = await requireRoles([...REGISTRAR, ...TEACHING, "student"]);
  if (memberHas(member, ["student"]) && !memberHas(member, [...REGISTRAR, ...TEACHING])) {
    return <StudentGrades db={supabase} userId={member.userId} />;
  }
  const registrar = memberHas(member, REGISTRAR);
  const term = await currentTerm(supabase);
  if (!term) return <PageHeader title="Grades" description="Set a current term first." />;
  let query = supabase
    .from("course_offerings")
    .select("id, section, instructor_id, courses(code, title), final_grades(status)")
    .eq("term_id", term.id);
  if (!registrar) query = query.eq("instructor_id", member.userId);
  const offerings = rows(await query);
  offerings.sort((a, b) => (a.courses?.code ?? "").localeCompare(b.courses?.code ?? ""));
  const statusOf = (o: (typeof offerings)[number]) => {
    const s = new Set(o.final_grades.map((g) => g.status));
    if (s.size === 0) return "not started";
    if (s.has("draft")) return "draft";
    if (s.has("submitted")) return "submitted";
    if (s.has("approved")) return "approved";
    return "locked";
  };
  const waiting = registrar
    ? offerings.filter((o) => ["submitted", "approved"].includes(statusOf(o)))
    : [];

  return (
    <>
      <PageHeader title="Grades" description={termLabel(term)} />
      <div className="flex flex-col gap-8">
        {registrar ? (
          <Section
            title="Waiting for you"
            id="waiting"
            description="Submitted grades to approve, and approved grades to lock and publish."
          >
            {waiting.length === 0 ? (
              <p className="text-muted">Nothing waiting.</p>
            ) : (
              <OfferingTable offerings={waiting} statusOf={statusOf} />
            )}
          </Section>
        ) : null}
        <Section title={registrar ? "All classes" : "My classes"} id="classes">
          {offerings.length === 0 ? (
            <EmptyState
              icon={<GraduationCap />}
              title="No classes"
              description="No course offerings this term."
            />
          ) : (
            <OfferingTable offerings={offerings} statusOf={statusOf} />
          )}
        </Section>
      </div>
    </>
  );
}

type OfferingRow = { id: string; section: string; courses: { code: string; title: string } | null };

function OfferingTable<T extends OfferingRow>({
  offerings,
  statusOf,
}: {
  offerings: T[];
  statusOf: (o: T) => string;
}) {
  return (
    <TableScroll label="Classes">
      <Table>
        <thead>
          <tr>
            <Th>Course</Th>
            <Th>Section</Th>
            <Th>Grades</Th>
            <Th>
              <span className="sr-only">Open</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {offerings.map((o) => {
            const status = statusOf(o);
            return (
              <tr key={o.id}>
                <Td>
                  <span className="font-semibold">{o.courses?.code}</span> {o.courses?.title}
                </Td>
                <Td>{o.section}</Td>
                <Td>
                  <Badge
                    variant={
                      status === "locked"
                        ? "brand"
                        : status === "submitted" || status === "approved"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {status}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Link
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                    href={`/grades/${o.id}`}
                  >
                    Open
                    <span className="sr-only">
                      {" "}
                      {o.courses?.code} section {o.section}
                    </span>
                  </Link>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableScroll>
  );
}

async function StudentGrades({ db, userId }: { db: SchoolDb; userId: string }) {
  const { data: student, error } = await db
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!student)
    return <PageHeader title="My grades" description="Your student record is not linked yet." />;
  const record = await loadAcademicRecord(db, student.id);
  return (
    <>
      <PageHeader
        title="My grades"
        description={`Cumulative GPA ${formatGpa(record.cgpa)} · ${record.creditsEarned} credits earned`}
        actions={
          <a
            className={buttonVariants({ variant: "secondary" })}
            href={`/reports/transcript/${student.id}`}
          >
            Download transcript
          </a>
        }
      />
      {record.terms.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title="No published grades yet"
          description="Grades appear here once the Registrar publishes them."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {[...record.terms].reverse().map((t) => (
            <Section
              key={t.termId}
              title={t.termName}
              id={`term-${t.termId}`}
              description={`Term GPA ${formatGpa(t.gpa)} · ${t.creditsEarned} credits earned`}
              actions={
                <a
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`/reports/grade-report/${student.id}/${t.termId}`}
                >
                  Grade report<span className="sr-only"> for {t.termName}</span>
                </a>
              }
            >
              <TableScroll label={`Grades for ${t.termName}`}>
                <Table>
                  <thead>
                    <tr>
                      <Th>Course</Th>
                      <Th>Credits</Th>
                      <Th>Score</Th>
                      <Th>Grade</Th>
                      <Th>Points</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.records.map((r) => (
                      <tr key={r.courseId}>
                        <Td>
                          <span className="font-semibold">{r.code}</span> {r.title}
                          {record.superseded.has(r) ? (
                            <p className="text-sm text-muted">
                              Repeated later; the later grade counts
                            </p>
                          ) : null}
                        </Td>
                        <Td>{r.credits}</Td>
                        <Td>{r.numericScore ?? "-"}</Td>
                        <Td className="font-bold">{r.letter ?? "-"}</Td>
                        <Td>{r.gradePoints ?? "-"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            </Section>
          ))}
        </div>
      )}
    </>
  );
}
