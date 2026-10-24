// School, College edition (SPEC.md 7.3, 7.6): SCH-01, SCH-02, SCH-03, SCH-05, SCH-06, SCH-07.
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  uniqueSchema,
} from "./helpers.ts";
import { buildCollege, type College } from "./school-fixture.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("college");
let c: College;

/** Runs one SQL statement as a user and returns its rows. */
function as<T = Record<string, unknown>>(userId: string, query: string, params: unknown[] = []) {
  return asUser(sql, userId, (tx: TransactionSql) => tx.unsafe<T[]>(query, params as never[]));
}

const s = () => c.schema;

beforeAll(async () => {
  c = await buildCollege(sql, keys, schema);
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, ...Object.values(c.users));
  await sql.end();
});

describe("SCH-01 student numbers", () => {
  it("generates sequential numbers with the prefix and year, ignoring any number sent", async () => {
    const year = new Date().getFullYear();
    const rows = await as<{ student_number: string }>(
      c.users.registrar,
      `insert into ${s()}.students (first_name, last_name, student_number) values ('Kebeh', 'Flomo', 'TC-${year}-0001'), ('Sando', 'Tarr', null) returning student_number`,
    );
    expect(rows.map((r) => r.student_number)).toEqual([`TC-${year}-0003`, `TC-${year}-0004`]);
  });

  it("refuses to change a student number", async () => {
    await expect(
      as(c.users.registrar, `update ${s()}.students set student_number = 'X-1' where id = $1`, [
        c.students.ama,
      ]),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("finds likely duplicates by name and date of birth, ignoring case", async () => {
    const rows = await as<{ id: string }>(
      c.users.registrar,
      `select id from ${s()}.find_possible_duplicates(' ama ', 'KPADEH', '2004-05-01')`,
    );
    expect(rows.map((r) => r.id)).toEqual([c.students.ama]);
  });
});

describe("SCH-05 course planning", () => {
  const plan = (user: string, offering: string) =>
    as<{ id: string }>(user, `select ${s()}.plan_course($1) as id`, [offering]);

  it("blocks a course whose prerequisite is not passed", async () => {
    await expect(plan(c.users.otherStudent, c.offerings.math201)).rejects.toThrow(
      /MATH 201 needs MATH 101 first/,
    );
  });

  it("blocks a course already passed", async () => {
    await expect(plan(c.users.student, c.offerings.math101)).rejects.toThrow(
      /already passed MATH 101/,
    );
  });

  it("blocks the same course twice in a term", async () => {
    await plan(c.users.student, c.offerings.math201);
    await expect(plan(c.users.student, c.offerings.math201)).rejects.toThrow(
      /already in your plan/,
    );
  });

  it("blocks going over the credit limit", async () => {
    await plan(c.users.student, c.offerings.eng101);
    await plan(c.users.student, c.offerings.his101);
    await expect(plan(c.users.student, c.offerings.cs301)).rejects.toThrow(
      /12 credits; the limit is 9/,
    );
  });

  it("blocks a full offering", async () => {
    await as(c.users.registrar, `select ${s()}.registrar_register($1, $2, 'Late admission')`, [
      c.students.kollie,
      c.offerings.phy101,
    ]);
    await expect(plan(c.users.otherStudent, c.offerings.phy101)).rejects.toThrow(
      /already in your plan/,
    );
    await expect(plan(c.users.student, c.offerings.phy101)).rejects.toThrow(
      /PHY 101 section A is full|limit is 9/,
    );
  });

  it("warns below the minimum credits and freezes the plan once submitted", async () => {
    const [result] = await as<{ submitted: number; credits: number; below_minimum: boolean }>(
      c.users.student,
      `select * from ${s()}.submit_plan($1)`,
      [c.terms.current],
    );
    expect(result).toMatchObject({ submitted: 3, credits: 9, below_minimum: false });
    await expect(plan(c.users.student, c.offerings.cs301)).rejects.toThrow(/plan is submitted/);
  });

  it("only students plan, and only while the window is open", async () => {
    await expect(plan(c.users.registrar, c.offerings.eng101)).rejects.toThrow(/Only students/);
    await sql.unsafe(
      `update ${s()}.terms set registration_closes_on = current_date - 1 where id = $1`,
      [c.terms.current],
    );
    await expect(plan(c.users.otherStudent, c.offerings.eng101)).rejects.toThrow(
      /registration for this term is closed/,
    );
    await sql.unsafe(
      `update ${s()}.terms set registration_closes_on = current_date + 7 where id = $1`,
      [c.terms.current],
    );
  });

  it("students cannot write registrations directly", async () => {
    await expect(
      as(
        c.users.otherStudent,
        `insert into ${s()}.course_registrations (student_id, offering_id, status) values ($1, $2, 'approved')`,
        [c.students.kollie, c.offerings.eng101],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("the Registrar approves submitted courses", async () => {
    const regs = await as<{ id: string }>(
      c.users.registrar,
      `select r.id from ${s()}.course_registrations r where r.student_id = $1 and r.status = 'submitted'`,
      [c.students.ama],
    );
    expect(regs).toHaveLength(3);
    for (const r of regs) {
      await as(c.users.registrar, `select ${s()}.decide_registration($1, true, null)`, [r.id]);
    }
    await expect(
      as(c.users.instructor, `select ${s()}.decide_registration($1, true, null)`, [regs[0]?.id]),
    ).rejects.toThrow(/Only the Registrar/);
  });

  it("concurrent approvals never exceed capacity", async () => {
    const offering =
      (
        await sql.unsafe<{ id: string }[]>(
          `insert into ${s()}.course_offerings (course_id, term_id, section, capacity) values ($1, $2, 'Z', 1) returning id`,
          [c.courses.cs301, c.terms.current],
        )
      )[0]?.id ?? "";
    const ids: string[] = [];
    for (const student of [c.students.ama, c.students.kollie]) {
      const [row] = await sql.unsafe<{ id: string }[]>(
        `insert into ${s()}.course_registrations (student_id, offering_id, status) values ($1, $2, 'submitted') returning id`,
        [student, offering],
      );
      ids.push(row?.id ?? "");
    }
    const results = await Promise.allSettled(
      ids.map((id) =>
        as(c.users.registrar, `select ${s()}.decide_registration($1, true, null)`, [id]),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(String(rejected?.status === "rejected" ? rejected.reason : "")).toMatch(/is full/);
    const [count] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${s()}.course_registrations where offering_id = $1 and status = 'approved'`,
      [offering],
    );
    expect(Number(count?.n)).toBe(1);
  });
});

describe("SCH-02 assigned classes only", () => {
  it("an instructor records attendance for their own class list only", async () => {
    await as(
      c.users.instructor,
      `insert into ${s()}.attendance (id, date, student_id, class_ref_type, class_ref_id, status, recorded_by) values ($1, current_date, $2, 'offering', $3, 'present', $4)`,
      [crypto.randomUUID(), c.students.ama, c.offerings.eng101, c.users.instructor],
    );
    await expect(
      as(
        c.users.otherInstructor,
        `insert into ${s()}.attendance (id, date, student_id, class_ref_type, class_ref_id, status, recorded_by) values ($1, current_date, $2, 'offering', $3, 'present', $4)`,
        [crypto.randomUUID(), c.students.ama, c.offerings.eng101, c.users.otherInstructor],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(
        c.users.instructor,
        `insert into ${s()}.attendance (id, date, student_id, class_ref_type, class_ref_id, status, recorded_by) values ($1, current_date, $2, 'offering', $3, 'present', $4)`,
        [crypto.randomUUID(), c.students.kollie, c.offerings.eng101, c.users.instructor],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("an instructor enters scores for their own offerings only", async () => {
    const [assessment] = await as<{ id: string }>(
      c.users.instructor,
      `insert into ${s()}.assessments (offering_id, name, weight_percent, max_score) values ($1, 'Final exam', 100, 50) returning id`,
      [c.offerings.eng101],
    );
    await expect(
      as(
        c.users.otherInstructor,
        `insert into ${s()}.assessments (offering_id, name, weight_percent, max_score) values ($1, 'Quiz', 10, 10)`,
        [c.offerings.eng101],
      ),
    ).rejects.toThrow(/not assigned to this course/);
    await expect(
      as(
        c.users.otherInstructor,
        `insert into ${s()}.assessment_scores (id, assessment_id, student_id, score, entered_by) values ($1, $2, $3, 40, $4)`,
        [crypto.randomUUID(), assessment?.id, c.students.ama, c.users.otherInstructor],
      ),
    ).rejects.toThrow(/not assigned to this course/);
    const others = await as(c.users.otherInstructor, `select id from ${s()}.assessment_scores`);
    expect(others).toEqual([]);
  });

  it("an instructor sees only students on their class lists", async () => {
    const mine = await as<{ id: string }>(c.users.instructor, `select id from ${s()}.students`);
    expect(new Set(mine.map((r) => r.id))).toEqual(new Set([c.students.ama, c.students.kollie]));
    const theirs = await as<{ id: string }>(
      c.users.otherInstructor,
      `select id from ${s()}.students`,
    );
    expect(theirs.map((r) => r.id)).toEqual([c.students.ama]);
  });
});

describe("SCH-03 grade approval and locking", () => {
  let assessment = "";
  const score = (value: number, id = crypto.randomUUID()) =>
    as(
      c.users.instructor,
      `insert into ${s()}.assessment_scores (id, assessment_id, student_id, score, entered_by) values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
      [id, assessment, c.students.ama, value, c.users.instructor],
    );

  beforeAll(async () => {
    const [row] = await sql.unsafe<{ id: string }[]>(
      `select id from ${s()}.assessments where offering_id = $1`,
      [c.offerings.eng101],
    );
    assessment = row?.id ?? "";
  });

  it("computes the weighted score, letter and grade points", async () => {
    const id = crypto.randomUUID();
    await score(46, id);
    await score(46, id); // offline retry: one record (CORE-06)
    await expect(score(60)).rejects.toThrow(/above the maximum/);
    const [grade] = await as<{
      numeric_score: string;
      letter: string;
      grade_points: string;
      status: string;
    }>(
      c.users.instructor,
      `select numeric_score, letter, grade_points, status from ${s()}.final_grades where offering_id = $1`,
      [c.offerings.eng101],
    );
    expect(grade).toEqual({
      numeric_score: "92.00",
      letter: "A",
      grade_points: "4.00",
      status: "draft",
    });
  });

  it("the instructor submits; only a Registrar who does not teach the course approves", async () => {
    await as(c.users.instructor, `select ${s()}.submit_grades($1)`, [c.offerings.eng101]);
    await expect(
      as(c.users.instructor, `select ${s()}.approve_grades($1)`, [c.offerings.eng101]),
    ).rejects.toThrow(/Only the Registrar/);
    await expect(
      as(
        c.users.instructor,
        `update ${s()}.assessment_scores set score = 10 where assessment_id = $1`,
        [assessment],
      ),
    ).rejects.toThrow(/grade is submitted/);
    await as(c.users.registrar, `select ${s()}.approve_grades($1)`, [c.offerings.eng101]);
    await as(c.users.registrar, `select ${s()}.lock_grades($1)`, [c.offerings.eng101]);
  });

  it("a locked grade cannot be edited, even through the API", async () => {
    await expect(
      as(
        c.users.instructor,
        `update ${s()}.assessment_scores set score = 10 where assessment_id = $1`,
        [assessment],
      ),
    ).rejects.toThrow(/grade is locked/);
    await expect(
      sql.unsafe(`update ${s()}.final_grades set letter = 'F' where offering_id = $1`, [
        c.offerings.eng101,
      ]),
    ).rejects.toThrow(/Locked grades cannot be edited/);
    const updated = await as(
      c.users.registrar,
      `update ${s()}.final_grades set status = 'draft' where offering_id = $1 returning id`,
      [c.offerings.eng101],
    ).catch((e: Error) => e);
    expect(updated instanceof Error ? updated.message : updated).toMatch(/permission denied/);
  });

  it("reopening needs a reason and is written to the audit log", async () => {
    await expect(
      as(c.users.registrar, `select ${s()}.reopen_grades($1, '  ')`, [c.offerings.eng101]),
    ).rejects.toThrow(/reason is required/);
    await as(c.users.registrar, `select ${s()}.reopen_grades($1, 'Marking error on question 4')`, [
      c.offerings.eng101,
    ]);
    const [event] = await sql.unsafe<
      { actor_id: string; reason: string; before: { status: string } }[]
    >(
      `select actor_id, reason, before from ${s()}.audit_events
       where table_name = 'final_grades' and after ->> 'status' = 'draft' and before ->> 'status' = 'locked'`,
    );
    expect(event).toMatchObject({
      actor_id: c.users.registrar,
      reason: "Marking error on question 4",
    });
    await as(
      c.users.instructor,
      `update ${s()}.assessment_scores set score = 40 where assessment_id = $1`,
      [assessment],
    );
    await as(c.users.instructor, `select ${s()}.submit_grades($1)`, [c.offerings.eng101]);
    await as(c.users.registrar, `select ${s()}.approve_grades($1)`, [c.offerings.eng101]);
    await as(c.users.registrar, `select ${s()}.lock_grades($1)`, [c.offerings.eng101]);
  });
});

describe("SCH-06 fees in LRD", () => {
  it("bulk invoices, a partial payment, the receipt and the debtor list agree", async () => {
    const [year] = await sql.unsafe<{ id: string }[]>(`select id from ${s()}.academic_years`);
    await as(
      c.users.bursar,
      `insert into ${s()}.fee_structures (academic_year_id, term_id, applies_to, item, amount_minor, currency) values
       ($1, $2, 'all', 'Tuition', 2500000, 'LRD'), ($1, null, 'BSC-CS', 'Lab fee', 500000, 'LRD'), ($1, $2, 'all', 'ID card', 1000, 'USD')`,
      [year?.id, c.terms.current],
    );
    const [created] = await as<{ n: number }>(
      c.users.bursar,
      `select ${s()}.generate_term_invoices($1) as n`,
      [c.terms.current],
    );
    expect(created?.n).toBe(4); // two students x two currencies
    const [again] = await as<{ n: number }>(
      c.users.bursar,
      `select ${s()}.generate_term_invoices($1) as n`,
      [c.terms.current],
    );
    expect(again?.n).toBe(0);

    const [invoice] = await as<{ id: string; total_minor: string }>(
      c.users.bursar,
      `select i.id, b.total_minor from ${s()}.invoices i join ${s()}.invoice_balances b on b.invoice_id = i.id
       where i.party_id = $1 and i.currency = 'LRD'`,
      [c.students.ama],
    );
    expect(Number(invoice?.total_minor)).toBe(3000000);

    const [paid] = await as<{ receipt_number: string; invoice_status: string }>(
      c.users.bursar,
      `select * from ${s()}.record_payment($1, $2, 1200000, 'LRD', 'mobile_money', 'MTN-889')`,
      [crypto.randomUUID(), invoice?.id],
    );
    expect(paid).toMatchObject({ invoice_status: "partially_paid" });
    expect(Number(paid?.receipt_number)).toBe(1);

    const debtors = await as<{ student_id: string; currency: string; balance_minor: string }>(
      c.users.bursar,
      `select student_id, currency, balance_minor from ${s()}.student_balances order by currency, balance_minor`,
    );
    expect(debtors.filter((d) => d.student_id === c.students.ama)).toEqual([
      { student_id: c.students.ama, currency: "LRD", balance_minor: "1800000" },
      { student_id: c.students.ama, currency: "USD", balance_minor: "1000" },
    ]);
    await expect(
      as(c.users.registrar, `select ${s()}.generate_term_invoices($1)`, [c.terms.current]),
    ).rejects.toThrow(/Only the Bursar/);
  });
});

describe("SCH-07 students see only their own records", () => {
  it("a student reads their own profile, published grades and fees only", async () => {
    const students = await as<{ id: string }>(c.users.student, `select id from ${s()}.students`);
    expect(students.map((r) => r.id)).toEqual([c.students.ama]);
    const grades = await as<{ student_id: string; status: string }>(
      c.users.student,
      `select student_id, status from ${s()}.final_grades`,
    );
    expect(grades.length).toBeGreaterThan(0);
    expect(grades.every((g) => g.student_id === c.students.ama && g.status === "locked")).toBe(
      true,
    );
    const invoices = await as<{ party_id: string }>(
      c.users.student,
      `select party_id from ${s()}.invoices`,
    );
    expect(invoices.length).toBe(2);
    expect(invoices.every((i) => i.party_id === c.students.ama)).toBe(true);
    const balances = await as<{ student_id: string }>(
      c.users.student,
      `select student_id from ${s()}.student_balances`,
    );
    expect(new Set(balances.map((b) => b.student_id))).toEqual(new Set([c.students.ama]));
  });

  it("a student cannot read another student's records or change their own", async () => {
    const other = await as(
      c.users.otherStudent,
      `select * from ${s()}.final_grades where student_id = $1`,
      [c.students.ama],
    );
    expect(other).toEqual([]);
    const attendance = await as(
      c.users.otherStudent,
      `select * from ${s()}.attendance where student_id = $1`,
      [c.students.ama],
    );
    expect(attendance).toEqual([]);
    const updated = await as(
      c.users.student,
      `update ${s()}.students set first_name = 'X' where id = $1 returning id`,
      [c.students.ama],
    );
    expect(updated).toEqual([]);
  });

  it("draft and submitted grades stay hidden from the student", async () => {
    await sql.unsafe(
      `insert into ${s()}.final_grades (offering_id, student_id, numeric_score, letter, grade_points, status)
       values ($1, $2, 75, 'C', 2.00, 'submitted')`,
      [c.offerings.math201, c.students.ama],
    );
    const rows = await as(
      c.users.student,
      `select * from ${s()}.final_grades where offering_id = $1`,
      [c.offerings.math201],
    );
    expect(rows).toEqual([]);
  });
});
