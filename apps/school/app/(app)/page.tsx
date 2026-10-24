import { Badge } from "@corex/ui/components/badge";
import { buttonVariants } from "@corex/ui/components/button";
import { PageHeader } from "@corex/ui/components/page-header";
import { Stat } from "@corex/ui/components/stat";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import type { CurrentMember } from "@corex/core/auth";
import { AnnouncementList } from "@/components/announcement-list";
import { formatScore } from "@/lib/averages";
import { edition } from "@/lib/edition";
import { familyStudents, loadTermReport } from "@/lib/highschool";
import { loadAcademicRecord } from "@/lib/academic";
import { formatGpa } from "@/lib/gpa";
import { money, percent, personName, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { currentTerm, rows, termLabel } from "@/lib/queries";
import { BURSAR, OFFICE, REGISTRAR, TEACHING } from "@/lib/roles";
import { getSession, memberHas } from "@/lib/session";
import type { SchoolDb } from "@/lib/supabase";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, member } = await getSession();
  const college = edition() === "college";
  return (
    <>
      <PageHeader title="Dashboard" description={`Welcome, ${member.displayName}.`} />
      <div className="flex flex-col gap-8">
        {memberHas(member, OFFICE) ? (
          <OfficeOverview
            college={college}
            db={supabase}
            registrar={memberHas(member, REGISTRAR)}
            bursar={memberHas(member, BURSAR)}
          />
        ) : null}
        {memberHas(member, TEACHING) ? (
          college ? (
            <TeachingOverview db={supabase} userId={member.userId} />
          ) : (
            <TeacherOverview db={supabase} userId={member.userId} />
          )
        ) : null}
        {memberHas(member, ["student"]) && college ? (
          <StudentOverview db={supabase} userId={member.userId} />
        ) : null}
        {memberHas(member, ["student", "parent"]) && !college ? (
          <FamilyOverview db={supabase} member={member} />
        ) : null}
        <section aria-labelledby="news-title" className="flex flex-col gap-3">
          <h2 id="news-title" className="text-xl font-bold">
            Announcements
          </h2>
          <AnnouncementList db={supabase} limit={3} />
        </section>
      </div>
    </>
  );
}

async function count(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
) {
  const { count: n, error } = await query;
  if (error) throw new Error(error.message);
  return n ?? 0;
}

async function OfficeOverview({
  college,
  db,
  registrar,
  bursar,
}: {
  college: boolean;
  db: SchoolDb;
  registrar: boolean;
  bursar: boolean;
}) {
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const [students, marked, present, plans, grades, fees] = await Promise.all([
    count(db.from("students").select("id", { count: "exact", head: true }).eq("status", "active")),
    registrar
      ? count(db.from("attendance").select("id", { count: "exact", head: true }).eq("date", today))
      : 0,
    registrar
      ? count(
          db
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("date", today)
            .in("status", ["present", "late"]),
        )
      : 0,
    registrar && college
      ? count(
          db
            .from("course_registrations")
            .select("id", { count: "exact", head: true })
            .eq("status", "submitted"),
        )
      : 0,
    registrar
      ? count(
          db
            .from(college ? "final_grades" : "period_scores")
            .select("id", { count: "exact", head: true })
            .in("status", ["submitted", "approved"]),
        )
      : 0,
    bursar
      ? db.from("fee_totals").select("currency, collected_minor, outstanding_minor").then(rows)
      : [],
  ]);

  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-3">
      <h2 id="overview-title" className="text-xl font-bold">
        School overview
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active students" value={students.toLocaleString("en-US")} />
        {registrar ? (
          <>
            <Stat
              label="Attendance today"
              value={percent(present, marked)}
              detail={`${marked} records`}
            />
            {college ? (
              <Stat
                label="Course registrations to approve"
                value={plans}
                detail={
                  plans > 0 ? (
                    <Link
                      className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                      href="/registration"
                    >
                      Open the queue
                    </Link>
                  ) : (
                    "All decided"
                  )
                }
              />
            ) : null}
            <Stat
              label={
                college
                  ? "Grades waiting for approval or lock"
                  : "Scores waiting for approval or lock"
              }
              value={grades}
              detail={
                grades > 0 ? (
                  <Link
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                    href="/grades"
                  >
                    Review grades
                  </Link>
                ) : (
                  "Nothing waiting"
                )
              }
            />
          </>
        ) : null}
        {fees.map((f) => (
          <Stat
            key={f.currency}
            label={`Fees in ${f.currency}`}
            value={money(f.collected_minor ?? 0, f.currency ?? "USD")}
            detail={`Collected · ${money(f.outstanding_minor ?? 0, f.currency ?? "USD")} outstanding`}
          />
        ))}
      </div>
    </section>
  );
}

async function TeachingOverview({ db, userId }: { db: SchoolDb; userId: string }) {
  const term = await currentTerm(db);
  if (!term) return null;
  const offerings = rows(
    await db
      .from("course_offerings")
      .select(
        "id, section, courses(code, title), course_registrations(status), final_grades(status)",
      )
      .eq("term_id", term.id)
      .eq("instructor_id", userId)
      .order("section"),
  );
  return (
    <section aria-labelledby="classes-title" className="flex flex-col gap-3">
      <h2 id="classes-title" className="text-xl font-bold">
        My classes, {termLabel(term)}
      </h2>
      {offerings.length === 0 ? (
        <p className="text-muted">You have no classes this term.</p>
      ) : (
        <TableScroll label="My classes">
          <Table>
            <thead>
              <tr>
                <Th>Course</Th>
                <Th>Section</Th>
                <Th>Students</Th>
                <Th>Grades</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => {
                const students = o.course_registrations.filter(
                  (r) => r.status === "approved",
                ).length;
                const statuses = new Set(o.final_grades.map((g) => g.status));
                const gradeStatus = statuses.size === 0 ? "Not started" : [...statuses].join(", ");
                return (
                  <tr key={o.id}>
                    <Td>
                      <span className="font-semibold">{o.courses?.code}</span> {o.courses?.title}
                    </Td>
                    <Td>{o.section}</Td>
                    <Td>{students}</Td>
                    <Td>
                      <Badge>{gradeStatus}</Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Link
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                        href={`/attendance?class=${o.id}`}
                      >
                        Attendance
                      </Link>{" "}
                      <Link
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                        href={`/grades/${o.id}`}
                      >
                        Grades
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </section>
  );
}

async function StudentOverview({ db, userId }: { db: SchoolDb; userId: string }) {
  const { data: student, error } = await db
    .from("students")
    .select("id, student_number, first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!student)
    return <p className="text-muted">Your student record is not linked yet. Ask the Registrar.</p>;
  const [record, balances, attendance] = await Promise.all([
    loadAcademicRecord(db, student.id),
    db
      .from("student_balances")
      .select("currency, balance_minor")
      .eq("student_id", student.id)
      .then(rows),
    db.from("attendance").select("status").eq("student_id", student.id).then(rows),
  ]);
  const attended = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  return (
    <section aria-labelledby="me-title" className="flex flex-col gap-3">
      <h2 id="me-title" className="text-xl font-bold">
        My record <span className="text-base font-normal text-muted">{student.student_number}</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Cumulative GPA"
          value={formatGpa(record.cgpa)}
          detail={`${record.creditsEarned} credits earned`}
        />
        <Stat
          label="Attendance"
          value={percent(attended, attendance.length)}
          detail={`${attendance.length} records`}
        />
        {balances.length === 0 ? (
          <Stat label="Fee balance" value="Nothing due" />
        ) : (
          balances.map((b) => (
            <Stat
              key={b.currency}
              label={`Fee balance (${b.currency})`}
              value={money(b.balance_minor ?? 0, b.currency ?? "USD")}
            />
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonVariants({ variant: "primary" })} href="/planning">
          Course planning
        </Link>
        <Link className={buttonVariants({ variant: "secondary" })} href="/grades">
          My grades
        </Link>
      </div>
    </section>
  );
}

async function TeacherOverview({ db, userId }: { db: SchoolDb; userId: string }) {
  const term = await currentTerm(db);
  if (!term) return null;
  const [homerooms, subjects] = await Promise.all([
    db
      .from("sections")
      .select("id, name, grade_levels(name), student_placements(id)")
      .eq("academic_year_id", term.academic_year_id)
      .eq("homeroom_teacher_id", userId)
      .then(rows),
    db
      .from("section_subjects")
      .select("id, subjects(name), sections!inner(name, academic_year_id, grade_levels(name))")
      .eq("teacher_id", userId)
      .eq("sections.academic_year_id", term.academic_year_id)
      .then(rows),
  ]);
  return (
    <section aria-labelledby="classes-title" className="flex flex-col gap-3">
      <h2 id="classes-title" className="text-xl font-bold">
        My classes, {termLabel(term)}
      </h2>
      {homerooms.length === 0 && subjects.length === 0 ? (
        <p className="text-muted">You have no classes this year.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {homerooms.map((h) => (
          <Link
            key={h.id}
            className={buttonVariants({ variant: "primary" })}
            href={`/attendance?class=${h.id}`}
          >
            Attendance, {h.grade_levels?.name} {h.name} ({h.student_placements.length})
          </Link>
        ))}
        {subjects.map((s) => (
          <Link
            key={s.id}
            className={buttonVariants({ variant: "secondary" })}
            href={`/grades/subject/${s.id}`}
          >
            {s.sections.grade_levels?.name} {s.sections.name} · {s.subjects?.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

async function FamilyOverview({ db, member }: { db: SchoolDb; member: CurrentMember }) {
  const [children, term] = await Promise.all([familyStudents(db, member), currentTerm(db)]);
  if (children.length === 0)
    return (
      <p className="text-muted">No student record is linked to this account yet. Ask the school.</p>
    );
  const summaries = await Promise.all(
    children.map(async (c) => ({
      child: c,
      report: term ? await loadTermReport(db, c.id, term.id) : null,
      balances: await db
        .from("student_balances")
        .select("currency, balance_minor")
        .eq("student_id", c.id)
        .then(rows),
    })),
  );
  return (
    <>
      {summaries.map(({ child, report, balances }) => {
        const days = report
          ? report.attendance.present +
            report.attendance.absent +
            report.attendance.late +
            report.attendance.excused
          : 0;
        return (
          <section
            key={child.id}
            aria-labelledby={`child-${child.id}`}
            className="flex flex-col gap-3"
          >
            <h2 id={`child-${child.id}`} className="text-xl font-bold">
              {personName(child)}{" "}
              <span className="text-base font-normal text-muted">
                {report?.gradeSection ?? child.student_number}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label={`Average, ${term?.name ?? "this term"}`}
                value={formatScore(report?.overall ?? null)}
                detail={report ? `Pass mark ${report.passMark}` : undefined}
              />
              <Stat
                label="Attendance this term"
                value={percent(
                  (report?.attendance.present ?? 0) + (report?.attendance.late ?? 0),
                  days,
                )}
                detail={`${days} days recorded`}
              />
              {balances.length === 0 ? (
                <Stat label="Fee balance" value="Nothing due" />
              ) : (
                balances.map((b) => (
                  <Stat
                    key={b.currency}
                    label={`Fee balance (${b.currency})`}
                    value={money(b.balance_minor ?? 0, b.currency ?? "USD")}
                  />
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({ variant: "secondary" })}
                href={`/grades?student=${child.id}`}
              >
                Grades<span className="sr-only"> for {personName(child)}</span>
              </Link>
            </div>
          </section>
        );
      })}
    </>
  );
}
