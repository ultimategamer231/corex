// A small, fully fictional College for local development and end-to-end tests:
// one sign-in per role, a finished term with published grades and a current term
// open for course registration. Local stack only; never run against a real project.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sql } from "postgres";
import { migrateSchema } from "../migrations.ts";
import { exposeSchemaLocally } from "../provision.ts";
import { assertSchemaName } from "../schema-name.ts";

export const FIXTURE_PASSWORD = "Test@2026pass";

export const COLLEGE_ROLES = [
  "super_admin",
  "registrar",
  "instructor",
  "bursar",
  "student",
] as const;
export type CollegeRole = (typeof COLLEGE_ROLES)[number];

/** Sign-in email for a role, for example registrar@e2e-college.corex.test. */
export function fixtureEmail(schema: string, role: CollegeRole): string {
  return `${role.replace("_", "-")}@${schema.replace(/_/g, "-")}.corex.test`;
}

const NAMES: Record<CollegeRole, string> = {
  super_admin: "Korpo Wleh",
  registrar: "Jartu Kollie",
  instructor: "Emmanuel Toe",
  bursar: "Hawa Sirleaf",
  student: "Ama Kpadeh",
};

export type CollegeFixture = {
  schema: string;
  users: Record<CollegeRole, { id: string; email: string; name: string }>;
  currentTermId: string;
  programId: string;
  offerings: Record<"math201" | "eng101" | "phy101", string>;
  studentId: string;
};

async function one<T>(sql: Sql, query: string, params: unknown[] = []): Promise<T> {
  const [row] = await sql.unsafe<T[]>(query, params as never[]);
  if (!row) throw new Error(`no row: ${query}`);
  return row;
}

/** Drops and rebuilds `schema` with the fixture data. Returns ids and sign-ins. */
export async function seedCollegeFixture(
  sql: Sql,
  admin: SupabaseClient,
  schemaName: string,
): Promise<CollegeFixture> {
  const s = assertSchemaName(schemaName);
  // Fixture users from an earlier run would break the one-email-per-client rule.
  const emails = COLLEGE_ROLES.map((r) => fixtureEmail(s, r));
  const old = await sql<{ id: string }[]>`select id from auth.users where email = any(${emails})`;
  await sql.unsafe(`drop schema if exists ${s} cascade`);
  for (const { id } of old) await admin.auth.admin.deleteUser(id);

  await migrateSchema(sql, s, "school");
  await sql.unsafe(
    `insert into ${s}.settings (org_name, address, phone, letterhead_text, config)
     values ('Sample College', 'Tubman Boulevard, Monrovia', '+231 770 000 000', 'Knowledge for service',
             '{"student_number_prefix": "SC", "max_credits_per_term": 12, "min_credits_per_term": 6}')`,
  );

  const users = {} as CollegeFixture["users"];
  for (const role of COLLEGE_ROLES) {
    const email = fixtureEmail(s, role);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not create ${email}: ${error.message}`);
    users[role] = { id: data.user.id, email, name: NAMES[role] };
    await sql.unsafe(
      `insert into ${s}.memberships (user_id, role, display_name) values ($1, $2, $3)`,
      [data.user.id, role, NAMES[role]],
    );
  }

  const year = await one<{ id: string }>(
    sql,
    `insert into ${s}.academic_years (name, starts_on, ends_on, is_current)
     values ('2026/2027', current_date - 200, current_date + 165, true) returning id`,
  );
  const past = await one<{ id: string }>(
    sql,
    `insert into ${s}.terms (academic_year_id, name, starts_on, ends_on)
     values ($1, 'Semester 1', current_date - 200, current_date - 30) returning id`,
    [year.id],
  );
  const current = await one<{ id: string }>(
    sql,
    `insert into ${s}.terms (academic_year_id, name, starts_on, ends_on, is_current, registration_opens_on, registration_closes_on)
     values ($1, 'Semester 2', current_date - 10, current_date + 120, true, current_date - 3, current_date + 14) returning id`,
    [year.id],
  );
  const dept = await one<{ id: string }>(
    sql,
    `insert into ${s}.departments (name, code) values ('Science and Technology', 'SCT') returning id`,
  );
  const program = await one<{ id: string }>(
    sql,
    `insert into ${s}.programs (department_id, name, code, award, total_credits_required, duration_terms)
     values ($1, 'Bachelor of Science in Computing', 'BSC-CS', 'Bachelor', 120, 8) returning id`,
    [dept.id],
  );
  const course = async (code: string, title: string, credits: number) =>
    (
      await one<{ id: string }>(
        sql,
        `insert into ${s}.courses (department_id, code, title, credits) values ($1, $2, $3, $4) returning id`,
        [dept.id, code, title, credits],
      )
    ).id;
  const math101 = await course("MATH 101", "College Algebra", 3);
  const math201 = await course("MATH 201", "Calculus I", 3);
  const eng101 = await course("ENG 101", "English Composition", 3);
  const phy101 = await course("PHY 101", "Physics for Scientists", 4);
  await sql.unsafe(
    `insert into ${s}.course_prerequisites (course_id, prerequisite_course_id) values ($1, $2)`,
    [math201, math101],
  );
  for (const [courseId, term] of [
    [math101, 1],
    [eng101, 1],
    [math201, 2],
    [phy101, 2],
  ] as const) {
    await sql.unsafe(
      `insert into ${s}.program_requirements (program_id, course_id, requirement_type, recommended_term) values ($1, $2, 'core', $3)`,
      [program.id, courseId, term],
    );
  }
  await sql.unsafe(
    `insert into ${s}.grade_scale (min_score, max_score, letter, grade_points, is_passing) values
     (90, 100, 'A', 4.00, true), (80, 89.99, 'B', 3.00, true), (70, 79.99, 'C', 2.00, true),
     (60, 69.99, 'D', 1.00, false), (0, 59.99, 'F', 0.00, false)`,
  );

  const student = await one<{ id: string }>(
    sql,
    `insert into ${s}.students (first_name, last_name, sex, date_of_birth, user_id, email)
     values ('Ama', 'Kpadeh', 'female', '2004-05-01', $1, $2) returning id`,
    [users.student.id, users.student.email],
  );
  await sql.unsafe(
    `insert into ${s}.program_enrollments (student_id, program_id, start_term_id) values ($1, $2, $3)`,
    [student.id, program.id, past.id],
  );

  const offering = async (courseId: string, termId: string, capacity: number) =>
    (
      await one<{ id: string }>(
        sql,
        `insert into ${s}.course_offerings (course_id, term_id, instructor_id, capacity, schedule_text) values ($1, $2, $3, $4, 'Mon and Wed, 9:00') returning id`,
        [courseId, termId, users.instructor.id, capacity],
      )
    ).id;
  const pastMath = await offering(math101, past.id, 40);
  await sql.unsafe(
    `insert into ${s}.course_registrations (student_id, offering_id, status) values ($1, $2, 'approved')`,
    [student.id, pastMath],
  );
  await sql.unsafe(
    `insert into ${s}.final_grades (offering_id, student_id, numeric_score, letter, grade_points, status, locked_at)
     values ($1, $2, 86.5, 'B', 3.00, 'locked', now())`,
    [pastMath, student.id],
  );

  const offerings = {
    math201: await offering(math201, current.id, 40),
    eng101: await offering(eng101, current.id, 40),
    phy101: await offering(phy101, current.id, 30),
  };
  await sql.unsafe(
    `insert into ${s}.fee_structures (academic_year_id, term_id, applies_to, item, amount_minor, currency) values
     ($1, $2, 'all', 'Tuition', 4500000, 'LRD'), ($1, null, 'BSC-CS', 'Computer lab', 2500, 'USD')`,
    [year.id, current.id],
  );
  await sql.unsafe(
    `insert into ${s}.announcements (title, body, published_at) values ('Registration is open', 'Plan your Semester 2 courses and submit your plan before the deadline.', now())`,
  );

  await exposeSchemaLocally(sql, s);
  return {
    schema: s,
    users,
    currentTermId: current.id,
    programId: program.id,
    offerings,
    studentId: student.id,
  };
}
