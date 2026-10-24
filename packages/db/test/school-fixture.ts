// A small College used by the School database tests: one user per role, a past
// term with locked grades and a current term open for registration.
import type { Sql } from "postgres";
import { migrateSchema } from "../src/migrations.ts";
import { createTestUser, testEmail, type LocalKeys } from "./helpers.ts";

export type College = {
  schema: string;
  users: Record<
    | "admin"
    | "registrar"
    | "instructor"
    | "otherInstructor"
    | "bursar"
    | "student"
    | "otherStudent",
    string
  >;
  students: { ama: string; kollie: string };
  terms: { past: string; current: string };
  courses: Record<"math101" | "math201" | "eng101" | "phy101" | "his101" | "cs301", string>;
  /** Current-term offerings. */
  offerings: Record<"math201" | "eng101" | "phy101" | "his101" | "cs301" | "math101", string>;
  pastMath101: string;
  program: string;
};

const PASSWORD = "Test@2026pass";

async function one<T>(sql: Sql, query: string, params: unknown[] = []): Promise<T> {
  const rows = await sql.unsafe<T[]>(query, params as never[]);
  if (!rows[0]) throw new Error(`no row: ${query}`);
  return rows[0];
}

export async function buildCollege(sql: Sql, keys: LocalKeys, schema: string): Promise<College> {
  await migrateSchema(sql, schema, "school");
  const s = schema;
  await sql.unsafe(
    `insert into ${s}.settings (org_name, config) values ('Test College', '{"student_number_prefix": "TC", "max_credits_per_term": 9, "min_credits_per_term": 6}')`,
  );

  const roles = {
    admin: "super_admin",
    registrar: "registrar",
    instructor: "instructor",
    otherInstructor: "instructor",
    bursar: "bursar",
    student: "student",
    otherStudent: "student",
  } as const;
  const users = {} as College["users"];
  for (const [key, role] of Object.entries(roles) as [keyof typeof roles, string][]) {
    users[key] = await createTestUser(keys, testEmail(key.toLowerCase()), PASSWORD);
    await sql.unsafe(
      `insert into ${s}.memberships (user_id, role, display_name) values ($1, $2, $3)`,
      [users[key], role, key],
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
     values ($1, 'Semester 2', current_date - 10, current_date + 120, true, current_date - 2, current_date + 7) returning id`,
    [year.id],
  );

  const dept = await one<{ id: string }>(
    sql,
    `insert into ${s}.departments (name, code) values ('Science', 'SCI') returning id`,
  );
  const program = await one<{ id: string }>(
    sql,
    `insert into ${s}.programs (department_id, name, code, award, total_credits_required, duration_terms)
     values ($1, 'BSc Computing', 'BSC-CS', 'Bachelor', 120, 8) returning id`,
    [dept.id],
  );
  const course = async (code: string, credits: number) =>
    (
      await one<{ id: string }>(
        sql,
        `insert into ${s}.courses (department_id, code, title, credits) values ($1, $2, $2, $3) returning id`,
        [dept.id, code, credits],
      )
    ).id;
  const courses = {
    math101: await course("MATH 101", 3),
    math201: await course("MATH 201", 3),
    eng101: await course("ENG 101", 3),
    phy101: await course("PHY 101", 3),
    his101: await course("HIS 101", 3),
    cs301: await course("CS 301", 3),
  };
  await sql.unsafe(
    `insert into ${s}.course_prerequisites (course_id, prerequisite_course_id) values ($1, $2), ($3, $2)`,
    [courses.math201, courses.math101, courses.cs301],
  );
  await sql.unsafe(
    `insert into ${s}.grade_scale (min_score, max_score, letter, grade_points, is_passing) values
     (90, 100, 'A', 4.00, true), (80, 89.99, 'B', 3.00, true), (70, 79.99, 'C', 2.00, true),
     (60, 69.99, 'D', 1.00, false), (0, 59.99, 'F', 0.00, false)`,
  );

  const student = async (first: string, last: string, userId: string) =>
    (
      await one<{ id: string }>(
        sql,
        `insert into ${s}.students (first_name, last_name, date_of_birth, user_id) values ($1, $2, '2004-05-01', $3) returning id`,
        [first, last, userId],
      )
    ).id;
  const students = {
    ama: await student("Ama", "Kpadeh", users.student),
    kollie: await student("Musu", "Kollie", users.otherStudent),
  };
  for (const id of Object.values(students)) {
    await sql.unsafe(
      `insert into ${s}.program_enrollments (student_id, program_id, start_term_id) values ($1, $2, $3)`,
      [id, program.id, past.id],
    );
  }

  const offering = async (
    courseId: string,
    termId: string,
    capacity = 30,
    instructor = users.instructor,
  ) =>
    (
      await one<{ id: string }>(
        sql,
        `insert into ${s}.course_offerings (course_id, term_id, instructor_id, capacity) values ($1, $2, $3, $4) returning id`,
        [courseId, termId, instructor, capacity],
      )
    ).id;
  const pastMath101 = await offering(courses.math101, past.id);
  // Ama passed MATH 101 last term (locked B); Musu failed it (locked F).
  await sql.unsafe(
    `insert into ${s}.course_registrations (student_id, offering_id, status) values ($1, $3, 'approved'), ($2, $3, 'approved')`,
    [students.ama, students.kollie, pastMath101],
  );
  await sql.unsafe(
    `insert into ${s}.final_grades (offering_id, student_id, numeric_score, letter, grade_points, status, locked_at) values
     ($1, $2, 85, 'B', 3.00, 'locked', now()), ($1, $3, 40, 'F', 0.00, 'locked', now())`,
    [pastMath101, students.ama, students.kollie],
  );

  const offerings = {
    math101: await offering(courses.math101, current.id),
    math201: await offering(courses.math201, current.id),
    eng101: await offering(courses.eng101, current.id),
    phy101: await offering(courses.phy101, current.id, 1),
    his101: await offering(courses.his101, current.id, 30, users.otherInstructor),
    cs301: await offering(courses.cs301, current.id),
  };

  return {
    schema,
    users,
    students,
    terms: { past: past.id, current: current.id },
    courses,
    offerings,
    pastMath101,
    program: program.id,
  };
}
