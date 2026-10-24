import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { EmptyState } from "@corex/ui/components/empty-state";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { CurrentMember } from "@corex/core/auth";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/section";
import { formatScore } from "@/lib/averages";
import { familyStudents, loadTermReport } from "@/lib/highschool";
import { personName } from "@/lib/format";
import { currentTerm, listTerms, rows, termLabel } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { memberHas } from "@/lib/session";
import type { SchoolDb } from "@/lib/supabase";

/** Status of a set of scores: the least advanced one decides. */
export function periodStatus(statuses: string[], expected: number): string {
  if (statuses.length === 0) return "not started";
  if (statuses.includes("draft") || statuses.length < expected) return "draft";
  if (statuses.includes("submitted")) return "submitted";
  if (statuses.includes("approved")) return "approved";
  return "locked";
}

export const STATUS_BADGE = {
  "not started": "neutral",
  draft: "neutral",
  submitted: "warning",
  approved: "warning",
  locked: "brand",
} as const;

/** Teachers: their subjects. Registrar: every subject, and what waits for approval. */
export async function HighSchoolStaffGrades({
  db,
  member,
}: {
  db: SchoolDb;
  member: CurrentMember;
}) {
  const registrar = memberHas(member, REGISTRAR);
  const term = await currentTerm(db);
  if (!term) return <PageHeader title="Grades" description="Set a current term first." />;
  let q = db
    .from("section_subjects")
    .select(
      "id, teacher_id, subjects(name), sections!inner(id, name, academic_year_id, grade_levels(name, sort_order), student_placements(id))",
    )
    .eq("sections.academic_year_id", term.academic_year_id);
  if (!registrar) q = q.eq("teacher_id", member.userId);
  const [classes, periods] = await Promise.all([
    q.then(rows),
    db
      .from("marking_periods")
      .select("id, number, name")
      .eq("term_id", term.id)
      .order("number")
      .then(rows),
  ]);
  const ids = classes.map((c) => c.id);
  const scores = ids.length
    ? rows(
        await db
          .from("period_scores")
          .select("section_subject_id, marking_period_id, status")
          .in("section_subject_id", ids)
          .in(
            "marking_period_id",
            periods.map((p) => p.id),
          ),
      )
    : [];
  classes.sort(
    (a, b) =>
      (a.sections.grade_levels?.sort_order ?? 0) - (b.sections.grade_levels?.sort_order ?? 0) ||
      a.sections.name.localeCompare(b.sections.name) ||
      (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? ""),
  );
  const statusOf = (ssId: string, mpId: string, size: number) =>
    periodStatus(
      scores
        .filter((s) => s.section_subject_id === ssId && s.marking_period_id === mpId)
        .map((s) => s.status),
      size,
    );
  const waiting = registrar
    ? classes.flatMap((c) =>
        periods
          .filter((p) =>
            ["submitted", "approved"].includes(
              statusOf(c.id, p.id, c.sections.student_placements.length),
            ),
          )
          .map((p) => ({
            c,
            p,
            status: statusOf(c.id, p.id, c.sections.student_placements.length),
          })),
      )
    : [];
  const label = (c: (typeof classes)[number]) =>
    `${c.sections.grade_levels?.name ?? ""} ${c.sections.name} · ${c.subjects?.name ?? ""}`;

  return (
    <>
      <PageHeader title="Grades" description={termLabel(term)} />
      <div className="flex flex-col gap-8">
        {registrar ? (
          <Section
            title="Waiting for you"
            id="waiting"
            description="Submitted scores to approve, and approved scores to lock and publish."
          >
            {waiting.length === 0 ? (
              <p className="text-muted">Nothing waiting.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {waiting.map(({ c, p, status }) => (
                  <li
                    key={`${c.id}-${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-2"
                  >
                    <span>
                      <span className="font-semibold">{label(c)}</span>, {p.name}{" "}
                      <Badge variant="warning">{status}</Badge>
                    </span>
                    <Link
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                      href={`/grades/subject/${c.id}?period=${p.id}`}
                    >
                      Review
                      <span className="sr-only">
                        {" "}
                        {label(c)}, {p.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}
        <Section title={registrar ? "All subjects" : "My subjects"} id="classes">
          {classes.length === 0 ? (
            <EmptyState
              icon={<GraduationCap />}
              title="No subjects"
              description="No subjects are assigned this year."
            />
          ) : periods.length === 0 ? (
            <p className="text-muted">The current term has no marking periods yet.</p>
          ) : (
            <TableScroll label="Subjects and marking periods">
              <Table>
                <thead>
                  <tr>
                    <Th>Class and subject</Th>
                    {periods.map((p) => (
                      <Th key={p.id}>{p.name}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <Link
                          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                          href={`/grades/subject/${c.id}`}
                        >
                          {label(c)}
                        </Link>
                      </Td>
                      {periods.map((p) => {
                        const status = statusOf(c.id, p.id, c.sections.student_placements.length);
                        return (
                          <Td key={p.id}>
                            <Badge
                              variant={
                                STATUS_BADGE[status as keyof typeof STATUS_BADGE] ?? "neutral"
                              }
                            >
                              {status}
                            </Badge>
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
      </div>
    </>
  );
}

/** Students and parents: published scores and averages per term (SPEC.md 7.5 portals). */
export async function HighSchoolFamilyGrades({
  db,
  member,
  studentId,
}: {
  db: SchoolDb;
  member: CurrentMember;
  studentId?: string;
}) {
  const children = await familyStudents(db, member);
  const child = children.find((c) => c.id === studentId) ?? children[0];
  if (!child)
    return (
      <PageHeader title="Grades" description="No student record is linked to this account yet." />
    );
  const term = await currentTerm(db);
  const terms = term
    ? (await listTerms(db)).filter((t) => t.academic_year_id === term.academic_year_id).reverse()
    : [];
  const reports = (await Promise.all(terms.map((t) => loadTermReport(db, child.id, t.id)))).filter(
    (r) => r !== null,
  );
  return (
    <>
      <PageHeader
        title={
          children.length > 1 || memberHas(member, ["parent"])
            ? `Grades: ${personName(child)}`
            : "My grades"
        }
        description={child.student_number}
      />
      {children.length > 1 ? (
        <nav aria-label="Children" className="mb-6 flex flex-wrap gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/grades?student=${c.id}`}
              aria-current={c.id === child.id ? "page" : undefined}
              className={buttonVariants({
                variant: c.id === child.id ? "primary" : "secondary",
                size: "sm",
              })}
            >
              {personName(c)}
            </Link>
          ))}
        </nav>
      ) : null}
      {reports.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title="No published scores yet"
          description="Scores appear here once the Registrar publishes them."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {reports.map((r) => (
            <Section
              key={r.term.id}
              title={r.term.label}
              id={`term-${r.term.id}`}
              description={`${r.gradeSection ?? ""} · overall average ${formatScore(r.overall)} · pass mark ${r.passMark}`}
              actions={
                <a
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`/reports/report-card/${child.id}/${r.term.id}`}
                >
                  Report card<span className="sr-only"> for {r.term.label}</span>
                </a>
              }
            >
              <TableScroll label={`Scores for ${r.term.label}`}>
                <Table>
                  <thead>
                    <tr>
                      <Th>Subject</Th>
                      {r.periods.map((p) => (
                        <Th key={p.id}>{p.name}</Th>
                      ))}
                      <Th>Average</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.subjects.map((s) => (
                      <tr key={s.sectionSubjectId}>
                        <Td className="font-semibold">{s.subject}</Td>
                        {r.periods.map((p) => (
                          <Td key={p.id}>
                            {s.scores.has(p.id) ? (s.scores.get(p.id) ?? 0).toFixed(2) : "-"}
                          </Td>
                        ))}
                        <Td className={s.passed === false ? "font-bold text-danger" : "font-bold"}>
                          {formatScore(s.average)}
                          {s.passed === false ? (
                            <span className="sr-only"> (below the pass mark)</span>
                          ) : null}
                        </Td>
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
