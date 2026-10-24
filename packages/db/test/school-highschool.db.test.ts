// School, High School edition (SPEC.md 7.4, 7.6): SCH-02, SCH-03, SCH-07, promotions
// and fees by grade level.
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import {
  asUser,
  createTestUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
  uniqueSchema,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const s = uniqueSchema("hs");

const users = {} as Record<
  "registrar" | "teacher" | "otherTeacher" | "bursar" | "parent" | "otherParent" | "student",
  string
>;
const ids = {} as Record<string, string>;

function as<T = Record<string, unknown>>(userId: string, query: string, params: unknown[] = []) {
  return asUser(sql, userId, (tx: TransactionSql) => tx.unsafe<T[]>(query, params as never[]));
}

async function id(query: string, params: unknown[] = []): Promise<string> {
  const [row] = await sql.unsafe<{ id: string }[]>(query, params as never[]);
  if (!row) throw new Error(`no row: ${query}`);
  return row.id;
}

beforeAll(async () => {
  await migrateSchema(sql, s, "school");
  await sql.unsafe(`insert into ${s}.settings (org_name) values ('Test High School')`);
  const roles = {
    registrar: "registrar",
    teacher: "teacher",
    otherTeacher: "teacher",
    bursar: "bursar",
    parent: "parent",
    otherParent: "parent",
    student: "student",
  } as const;
  for (const [key, role] of Object.entries(roles) as [keyof typeof roles, string][]) {
    users[key] = await createTestUser(keys, testEmail(key.toLowerCase()), "Test@2026pass");
    await sql.unsafe(
      `insert into ${s}.memberships (user_id, role, display_name) values ($1, $2, $3)`,
      [users[key], role, key],
    );
  }
  ids.year = await id(
    `insert into ${s}.academic_years (name, starts_on, ends_on, is_current) values ('2026/2027', current_date - 30, current_date + 300, true) returning id`,
  );
  ids.nextYear = await id(
    `insert into ${s}.academic_years (name, starts_on, ends_on) values ('2027/2028', current_date + 301, current_date + 660) returning id`,
  );
  ids.term = await id(
    `insert into ${s}.terms (academic_year_id, name, starts_on, ends_on, is_current) values ($1, 'Semester 1', current_date - 30, current_date + 120, true) returning id`,
    [ids.year],
  );
  ids.g11 = await id(
    `insert into ${s}.grade_levels (name, sort_order) values ('Grade 11', 11) returning id`,
  );
  ids.g12 = await id(
    `insert into ${s}.grade_levels (name, sort_order) values ('Grade 12', 12) returning id`,
  );
  ids.sectionA = await id(
    `insert into ${s}.sections (grade_level_id, academic_year_id, name, homeroom_teacher_id) values ($1, $2, 'A', $3) returning id`,
    [ids.g11, ids.year, users.teacher],
  );
  ids.sectionB = await id(
    `insert into ${s}.sections (grade_level_id, academic_year_id, name, homeroom_teacher_id) values ($1, $2, 'B', $3) returning id`,
    [ids.g11, ids.year, users.otherTeacher],
  );
  ids.g12A = await id(
    `insert into ${s}.sections (grade_level_id, academic_year_id, name) values ($1, $2, 'A') returning id`,
    [ids.g12, ids.year],
  );
  ids.nextG12A = await id(
    `insert into ${s}.sections (grade_level_id, academic_year_id, name) values ($1, $2, 'A') returning id`,
    [ids.g12, ids.nextYear],
  );
  ids.nextG11A = await id(
    `insert into ${s}.sections (grade_level_id, academic_year_id, name) values ($1, $2, 'A') returning id`,
    [ids.g11, ids.nextYear],
  );
  ids.math = await id(
    `insert into ${s}.subjects (name, code) values ('Mathematics', 'MATH') returning id`,
  );
  ids.mathA = await id(
    `insert into ${s}.section_subjects (section_id, subject_id, teacher_id) values ($1, $2, $3) returning id`,
    [ids.sectionA, ids.math, users.teacher],
  );
  ids.mathB = await id(
    `insert into ${s}.section_subjects (section_id, subject_id, teacher_id) values ($1, $2, $3) returning id`,
    [ids.sectionB, ids.math, users.otherTeacher],
  );
  ids.p1 = await id(
    `insert into ${s}.marking_periods (term_id, number, name) values ($1, 1, 'Period 1') returning id`,
    [ids.term],
  );
  const student = (first: string, userId: string | null) =>
    id(
      `insert into ${s}.students (first_name, last_name, user_id) values ($1, 'Doe', $2) returning id`,
      [first, userId],
    );
  ids.kebeh = await student("Kebeh", users.student);
  ids.sando = await student("Sando", null);
  ids.garmai = await student("Garmai", null);
  ids.senior = await student("Senior", null);
  for (const [studentId, section] of [
    [ids.kebeh, ids.sectionA],
    [ids.sando, ids.sectionA],
    [ids.garmai, ids.sectionB],
    [ids.senior, ids.g12A],
  ] as const) {
    await sql.unsafe(
      `insert into ${s}.student_placements (student_id, section_id, academic_year_id) values ($1, $2, $3)`,
      [
        studentId,
        section,
        ids.nextYear, // replaced by the trigger with the section's year
      ],
    );
  }
  ids.guardian = await id(
    `insert into ${s}.guardians (first_name, last_name, user_id) values ('Mother', 'Doe', $1) returning id`,
    [users.parent],
  );
  await sql.unsafe(
    `insert into ${s}.student_guardians (student_id, guardian_id, is_primary) values ($1, $2, true)`,
    [ids.kebeh, ids.guardian],
  );
  ids.otherGuardian = await id(
    `insert into ${s}.guardians (first_name, last_name, user_id) values ('Father', 'Other', $1) returning id`,
    [users.otherParent],
  );
  await sql.unsafe(
    `insert into ${s}.student_guardians (student_id, guardian_id, is_primary) values ($1, $2, true)`,
    [ids.garmai, ids.otherGuardian],
  );
});

afterAll(async () => {
  await dropSchemas(sql, s);
  await deleteTestUsers(keys, ...Object.values(users));
  await sql.end();
});

const score = (
  user: string,
  studentId: string,
  sectionSubject: string,
  value: number,
  scoreId = crypto.randomUUID(),
) =>
  as(
    user,
    `insert into ${s}.period_scores (id, student_id, section_subject_id, marking_period_id, score, entered_by)
     values ($1, $2, $3, $4, $5, $6) on conflict (id) do nothing`,
    [scoreId, studentId, sectionSubject, ids.p1, value, user],
  );

describe("placements", () => {
  it("take the academic year from the section, one per student per year", async () => {
    const [row] = await sql.unsafe<{ academic_year_id: string }[]>(
      `select academic_year_id from ${s}.student_placements where student_id = $1`,
      [ids.kebeh],
    );
    expect(row?.academic_year_id).toBe(ids.year);
    await expect(
      sql.unsafe(
        `insert into ${s}.student_placements (student_id, section_id, academic_year_id) values ($1, $2, $3)`,
        [ids.kebeh, ids.sectionB, ids.year],
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("SCH-02 assigned sections only", () => {
  it("only the homeroom teacher records the section's daily attendance", async () => {
    await as(
      users.teacher,
      `insert into ${s}.attendance (id, date, student_id, class_ref_type, class_ref_id, status, recorded_by) values ($1, current_date, $2, 'section', $3, 'present', $4)`,
      [crypto.randomUUID(), ids.kebeh, ids.sectionA, users.teacher],
    );
    await expect(
      as(
        users.otherTeacher,
        `insert into ${s}.attendance (id, date, student_id, class_ref_type, class_ref_id, status, recorded_by) values ($1, current_date, $2, 'section', $3, 'present', $4)`,
        [crypto.randomUUID(), ids.sando, ids.sectionA, users.otherTeacher],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a teacher scores only their own subject and only students in the section", async () => {
    await score(users.teacher, ids.kebeh, ids.mathA, 82);
    await expect(score(users.otherTeacher, ids.sando, ids.mathA, 70)).rejects.toThrow(
      /not assigned to this subject/,
    );
    await expect(score(users.teacher, ids.garmai, ids.mathA, 70)).rejects.toThrow(
      /not in this section/,
    );
    await expect(score(users.teacher, ids.kebeh, ids.mathA, 101)).rejects.toThrow(
      /check constraint/,
    );
  });

  it("a teacher sees only students in their sections", async () => {
    const rows = await as<{ id: string }>(
      users.otherTeacher,
      `select id from ${s}.students order by first_name`,
    );
    expect(rows.map((r) => r.id)).toEqual([ids.garmai]);
  });
});

describe("SCH-03 approval and locking", () => {
  it("submits only when every student has a score", async () => {
    await expect(
      as(users.teacher, `select ${s}.submit_period_scores($1, $2)`, [ids.mathA, ids.p1]),
    ).rejects.toThrow(/1 scores are still missing/);
    const retry = crypto.randomUUID();
    await score(users.teacher, ids.sando, ids.mathA, 64, retry);
    await score(users.teacher, ids.sando, ids.mathA, 64, retry); // offline retry: one record
    await as(users.teacher, `select ${s}.submit_period_scores($1, $2)`, [ids.mathA, ids.p1]);
  });

  it("a teacher cannot change status directly or edit a submitted score", async () => {
    await expect(
      as(
        users.teacher,
        `update ${s}.period_scores set status = 'locked' where section_subject_id = $1`,
        [ids.mathA],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(users.teacher, `update ${s}.period_scores set score = 99 where section_subject_id = $1`, [
        ids.mathA,
      ]),
    ).rejects.toThrow(/score is submitted/);
    await expect(
      as(users.teacher, `select ${s}.approve_period_scores($1, $2)`, [ids.mathA, ids.p1]),
    ).rejects.toThrow(/Only the Registrar/);
  });

  it("the Registrar approves and locks; locked scores cannot be edited", async () => {
    await as(users.registrar, `select ${s}.approve_period_scores($1, $2)`, [ids.mathA, ids.p1]);
    await as(users.registrar, `select ${s}.lock_period_scores($1, $2)`, [ids.mathA, ids.p1]);
    await expect(
      as(users.teacher, `update ${s}.period_scores set score = 99 where section_subject_id = $1`, [
        ids.mathA,
      ]),
    ).rejects.toThrow(/score is locked/);
  });

  it("reopening needs a reason and is written to the audit log", async () => {
    await expect(
      as(users.registrar, `select ${s}.reopen_period_scores($1, $2, ' ')`, [ids.mathA, ids.p1]),
    ).rejects.toThrow(/reason is required/);
    await as(
      users.registrar,
      `select ${s}.reopen_period_scores($1, $2, 'Wrong paper marked', $3)`,
      [ids.mathA, ids.p1, ids.sando],
    );
    const [event] = await sql.unsafe<{ actor_id: string; reason: string }[]>(
      `select actor_id, reason from ${s}.audit_events
       where table_name = 'period_scores' and before ->> 'status' = 'locked' and after ->> 'status' = 'draft'`,
    );
    expect(event).toEqual({ actor_id: users.registrar, reason: "Wrong paper marked" });
    await as(users.teacher, `update ${s}.period_scores set score = 68 where student_id = $1`, [
      ids.sando,
    ]);
    await as(users.teacher, `select ${s}.submit_period_scores($1, $2)`, [ids.mathA, ids.p1]);
    await as(users.registrar, `select ${s}.approve_period_scores($1, $2)`, [ids.mathA, ids.p1]);
    await as(users.registrar, `select ${s}.lock_period_scores($1, $2)`, [ids.mathA, ids.p1]);
  });
});

describe("SCH-07 parents see only their linked children", () => {
  it("a parent reads the linked child's record and locked scores only", async () => {
    const students = await as<{ id: string }>(users.parent, `select id from ${s}.students`);
    expect(students.map((r) => r.id)).toEqual([ids.kebeh]);
    const scores = await as<{ student_id: string; status: string }>(
      users.parent,
      `select student_id, status from ${s}.period_scores`,
    );
    expect(scores).toEqual([{ student_id: ids.kebeh, status: "locked" }]);
    const attendance = await as<{ student_id: string }>(
      users.parent,
      `select student_id from ${s}.attendance`,
    );
    expect(attendance.every((a) => a.student_id === ids.kebeh)).toBe(true);
  });

  it("another parent sees nothing of that child", async () => {
    const rows = await as(users.otherParent, `select id from ${s}.students where id = $1`, [
      ids.kebeh,
    ]);
    expect(rows).toEqual([]);
    const scores = await as(users.otherParent, `select id from ${s}.period_scores`);
    expect(scores).toEqual([]);
  });

  it("draft scores stay hidden from the student", async () => {
    const p2 = await id(
      `insert into ${s}.marking_periods (term_id, number, name) values ($1, 2, 'Period 2') returning id`,
      [ids.term],
    );
    await as(
      users.teacher,
      `insert into ${s}.period_scores (id, student_id, section_subject_id, marking_period_id, score, entered_by) values ($1, $2, $3, $4, 90, $5)`,
      [crypto.randomUUID(), ids.kebeh, ids.mathA, p2, users.teacher],
    );
    const rows = await as<{ marking_period_id: string }>(
      users.student,
      `select marking_period_id from ${s}.period_scores`,
    );
    expect(rows.map((r) => r.marking_period_id)).toEqual([ids.p1]);
  });
});

describe("rank in section", () => {
  it("returns only the asking family's rank, from locked scores", async () => {
    const [mine] = await as<{ rank: number; out_of: number }>(
      users.parent,
      `select * from ${s}.student_rank($1, $2)`,
      [ids.kebeh, ids.term],
    );
    expect(mine).toEqual({ rank: 1, out_of: 2 });
    const others = await as(users.otherParent, `select * from ${s}.student_rank($1, $2)`, [
      ids.kebeh,
      ids.term,
    ]);
    expect(others).toEqual([]);
  });
});

describe("fees by grade level", () => {
  it("invoices each placed student from the items for their grade level", async () => {
    await as(
      users.bursar,
      `insert into ${s}.fee_structures (academic_year_id, applies_to, item, amount_minor, currency) values
       ($1, 'Grade 11', 'Tuition', 1500000, 'LRD'), ($1, 'all', 'Report card', 50000, 'LRD')`,
      [ids.year],
    );
    const [created] = await as<{ n: number }>(
      users.bursar,
      `select ${s}.generate_term_invoices($1) as n`,
      [ids.term],
    );
    expect(created?.n).toBe(4);
    const [kebeh] = await sql.unsafe<{ total_minor: string }[]>(
      `select b.total_minor from ${s}.invoices i join ${s}.invoice_balances b on b.invoice_id = i.id where i.party_id = $1`,
      [ids.kebeh],
    );
    expect(Number(kebeh?.total_minor)).toBe(1550000);
    const [senior] = await sql.unsafe<{ total_minor: string }[]>(
      `select b.total_minor from ${s}.invoices i join ${s}.invoice_balances b on b.invoice_id = i.id where i.party_id = $1`,
      [ids.senior],
    );
    expect(Number(senior?.total_minor)).toBe(50000);
  });
});

describe("promotions", () => {
  it("places promoted and repeating students for next year and graduates the top grade", async () => {
    await as(
      users.registrar,
      `insert into ${s}.promotions (student_id, academic_year_id, decision) values
       ($1, $4, 'promoted'), ($2, $4, 'repeat'), ($3, $4, 'promoted')`,
      [ids.kebeh, ids.sando, ids.senior, ids.year],
    );
    const [result] = await as<{ n: number }>(
      users.registrar,
      `select ${s}.apply_promotions($1, $2) as n`,
      [ids.year, ids.nextYear],
    );
    expect(result?.n).toBe(2);
    const placed = await sql.unsafe<{ student_id: string; section_id: string }[]>(
      `select student_id, section_id from ${s}.student_placements where academic_year_id = $1`,
      [ids.nextYear],
    );
    expect(Object.fromEntries(placed.map((p) => [p.student_id, p.section_id]))).toEqual({
      [ids.kebeh]: ids.nextG12A,
      [ids.sando]: ids.nextG11A,
    });
    const [senior] = await sql.unsafe<{ status: string }[]>(
      `select status from ${s}.students where id = $1`,
      [ids.senior],
    );
    expect(senior?.status).toBe("graduated");
    const [again] = await as<{ n: number }>(
      users.registrar,
      `select ${s}.apply_promotions($1, $2) as n`,
      [ids.year, ids.nextYear],
    );
    expect(again?.n).toBe(0);
    await expect(
      as(users.teacher, `select ${s}.apply_promotions($1, $2)`, [ids.year, ids.nextYear]),
    ).rejects.toThrow(/Only the Registrar/);
  });
});
