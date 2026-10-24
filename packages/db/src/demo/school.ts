// Demo data for the School demos (SPEC.md 11.4). Fully fictional, built from a fixed
// random seed, with dates relative to today so the demo always looks current. Runs
// inside the reset transaction with `corex.demo_seeding` on, so every row is marked
// as a sample record (is_seed).
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { address, firstName, person, phone, type Person } from "./people.ts";
import type { Random } from "./random.ts";

type Value = string | number | boolean | null | Record<string, unknown>;
type Row = Record<string, Value>;

export type SeedContext = {
  tx: TransactionSql;
  schema: string;
  random: Random;
  /** User ids by account slug (admin, registrar, ..., faculty1, ...). */
  users: Record<string, string>;
};

const DAY = 86_400_000;

/** Today's date in Monrovia (UTC, no daylight saving) plus `offset` days, as yyyy-mm-dd. */
export function day(offset = 0, now = Date.now()): string {
  return new Date(now + offset * DAY).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

function userId(ctx: SeedContext, slug: string): string {
  const id = ctx.users[slug];
  if (!id) throw new Error(`Demo account "${slug}" is missing.`);
  return id;
}

/** Multi-row insert in chunks that stay under Postgres's parameter limit. */
async function insert(ctx: SeedContext, table: string, rows: Row[]): Promise<void> {
  const first = rows[0];
  if (!first) return;
  const size = Math.max(1, Math.floor(20_000 / Object.keys(first).length));
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await ctx.tx`insert into ${ctx.tx(`${ctx.schema}.${table}`)} ${ctx.tx(chunk)}`;
  }
}

/** Runs `fn` as a signed-in user, for functions that check the caller's role. */
async function asUser<T>(ctx: SeedContext, id: string, fn: () => Promise<T>): Promise<T> {
  await ctx.tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: id, role: "authenticated" })}, true)`;
  try {
    return await fn();
  } finally {
    await ctx.tx`select set_config('request.jwt.claims', '', true)`;
  }
}

type Term = { id: string; name: string; startsOn: string; endsOn: string };

async function academicYear(
  ctx: SeedContext,
  startsOn: string,
  endsOn: string,
  current: boolean,
): Promise<string> {
  const id = randomUUID();
  const start = yearOf(startsOn);
  await insert(ctx, "academic_years", [
    {
      id,
      name: `${start}/${start + 1}`,
      starts_on: startsOn,
      ends_on: endsOn,
      is_current: current,
    },
  ]);
  return id;
}

async function term(
  ctx: SeedContext,
  yearId: string,
  name: string,
  startsOn: string,
  endsOn: string,
  extra: Row = {},
): Promise<Term> {
  const id = randomUUID();
  await insert(ctx, "terms", [
    {
      id,
      academic_year_id: yearId,
      name,
      starts_on: startsOn,
      ends_on: endsOn,
      is_current: false,
      registration_opens_on: null,
      registration_closes_on: null,
      ...extra,
    },
  ]);
  return { id, name, startsOn, endsOn };
}

type NewStudent = Person & { id: string; dateOfBirth: string; userId?: string; email?: string };

async function insertStudents(ctx: SeedContext, students: NewStudent[]): Promise<void> {
  await insert(
    ctx,
    "students",
    students.map((s) => ({
      id: s.id,
      // Assigned by the database (assign_student_number).
      student_number: "",
      first_name: s.firstName,
      middle_name: s.middleName,
      last_name: s.lastName,
      sex: s.sex,
      date_of_birth: s.dateOfBirth,
      phone: s.userId ? phone(ctx.random) : ctx.random.chance(0.6) ? phone(ctx.random) : null,
      email: s.email ?? null,
      address: address(ctx.random),
      status: "active",
      user_id: s.userId ?? null,
    })),
  );
}

function birthDate(random: Random, year: number): string {
  return `${year}-${String(random.int(1, 12)).padStart(2, "0")}-${String(random.int(1, 28)).padStart(2, "0")}`;
}

async function announcements(
  ctx: SeedContext,
  items: { title: string; body: string; daysAgo: number; roles?: string[] }[],
): Promise<void> {
  await insert(
    ctx,
    "announcements",
    items.map((a) => ({
      title: a.title,
      body: a.body,
      audience_roles: `{${(a.roles ?? []).join(",")}}`,
      created_by: userId(ctx, "admin"),
      published_at: `${day(-a.daysAgo)}T09:00:00Z`,
    })),
  );
}

// Fees --------------------------------------------------------------------------

type FeeMix = { paid: number; partial: number; unpaid: number };

const METHODS = [
  ["cash", 45],
  ["mobile_money", 35],
  ["bank", 20],
] as const;

/**
 * Issues the term's fee invoices as the Bursar, dates them from the term start and
 * records payments so the invoices end up paid, partly paid or unpaid in `mix`.
 */
async function billTerm(ctx: SeedContext, t: Term, mix: FeeMix): Promise<void> {
  const { tx, schema: s, random } = ctx;
  const bursar = userId(ctx, "bursar");
  const due = addDays(t.startsOn, 30);
  await asUser(ctx, bursar, () => tx.unsafe(`select ${s}.generate_term_invoices($1)`, [t.id]));
  const invoices = await tx.unsafe<{ id: string; currency: string; total: string }[]>(
    `select i.id, i.currency, sum(l.amount_minor)::text as total
     from ${s}.term_invoices ti
     join ${s}.invoices i on i.id = ti.invoice_id
     join ${s}.invoice_lines l on l.invoice_id = i.id
     where ti.term_id = $1
     group by i.id, i.currency, ti.student_id
     order by ti.student_id, i.currency`,
    [t.id],
  );
  await tx.unsafe(
    `update ${s}.invoices set issue_date = $2, due_date = $3
     where id in (select invoice_id from ${s}.term_invoices where term_id = $1)`,
    [t.id, t.startsOn, due],
  );

  // Payments up to yesterday, so no receipt is dated later than now.
  const yesterday = day(-1);
  const lastDay = t.endsOn < yesterday ? t.endsOn : yesterday;
  const spread = Math.max(1, (Date.parse(lastDay) - Date.parse(t.startsOn)) / DAY);
  const payments: Row[] = [];
  for (const invoice of invoices) {
    const total = Number(invoice.total);
    const unit = invoice.currency === "USD" ? 100 : 10_000;
    const state = random.weighted([
      ["paid", mix.paid],
      ["partial", mix.partial],
      ["unpaid", mix.unpaid],
    ] as const);
    if (state === "unpaid") continue;
    let amounts: number[];
    if (state === "paid") {
      const first = random.chance(0.4)
        ? Math.round((total * random.int(40, 70)) / 100 / unit) * unit
        : total;
      amounts = first > 0 && first < total ? [first, total - first] : [total];
    } else {
      const part = Math.round((total * random.int(25, 75)) / 100 / unit) * unit;
      amounts = [Math.min(Math.max(part, unit), total - unit)];
    }
    let offset = random.int(0, Math.min(25, Math.floor(spread)));
    for (const amount of amounts) {
      if (amount <= 0) continue;
      const method = random.weighted(METHODS);
      payments.push({
        id: randomUUID(),
        invoice: invoice.id,
        amount,
        currency: invoice.currency,
        method,
        reference:
          method === "mobile_money"
            ? `MM${random.int(10_000_000, 99_999_999)}`
            : method === "bank"
              ? `DEP-${random.int(100_000, 999_999)}`
              : null,
        received: `${addDays(t.startsOn, Math.min(offset, Math.floor(spread)))}T${String(random.int(8, 16)).padStart(2, "0")}:${String(random.int(0, 59)).padStart(2, "0")}:00Z`,
      });
      offset += random.int(10, 40);
    }
  }
  if (payments.length === 0) return;
  await asUser(ctx, bursar, () =>
    tx.unsafe(
      `select p.payment_id
       from jsonb_to_recordset($1::text::jsonb) as x(id uuid, invoice uuid, amount bigint, currency text, method text, reference text, received timestamptz),
       lateral ${s}.record_payment(x.id, x.invoice, x.amount, x.currency, x.method, x.reference, x.received) p`,
      [JSON.stringify(payments)],
    ),
  );
}

// College --------------------------------------------------------------------------

type CourseDef = [code: string, title: string, credits: number, dept: string, prereqs?: string[]];

const DEPARTMENTS = [
  ["SCT", "Science and Technology"],
  ["BUS", "Business and Economics"],
  ["AHU", "Arts and Humanities"],
] as const;

const COURSES: CourseDef[] = [
  ["MATH 101", "College Algebra", 3, "SCT"],
  ["MATH 102", "Precalculus", 3, "SCT", ["MATH 101"]],
  ["MATH 201", "Calculus I", 4, "SCT", ["MATH 102"]],
  ["MATH 202", "Calculus II", 4, "SCT", ["MATH 201"]],
  ["STAT 201", "Introduction to Statistics", 3, "SCT", ["MATH 101"]],
  ["CS 101", "Introduction to Computing", 3, "SCT"],
  ["CS 102", "Programming I", 3, "SCT", ["CS 101"]],
  ["CS 201", "Programming II", 3, "SCT", ["CS 102"]],
  ["CS 202", "Data Structures", 3, "SCT", ["CS 201"]],
  ["CS 301", "Database Systems", 3, "SCT", ["CS 202"]],
  ["CS 302", "Computer Networks", 3, "SCT", ["CS 201"]],
  ["CS 303", "Web Development", 3, "SCT", ["CS 201"]],
  ["BIO 101", "General Biology", 4, "SCT"],
  ["CHEM 101", "General Chemistry", 4, "SCT"],
  ["PHY 101", "Physics I", 4, "SCT", ["MATH 101"]],
  ["AGR 101", "Introduction to Agriculture", 3, "SCT"],
  ["AGR 201", "Soil Science", 3, "SCT", ["AGR 101"]],
  ["AGR 202", "Crop Production", 3, "SCT", ["AGR 101"]],
  ["AGR 203", "Animal Husbandry", 3, "SCT", ["AGR 101"]],
  ["ACC 101", "Principles of Accounting I", 3, "BUS"],
  ["ACC 102", "Principles of Accounting II", 3, "BUS", ["ACC 101"]],
  ["ACC 201", "Intermediate Accounting", 3, "BUS", ["ACC 102"]],
  ["ACC 301", "Auditing", 3, "BUS", ["ACC 201"]],
  ["ECON 101", "Microeconomics", 3, "BUS"],
  ["ECON 102", "Macroeconomics", 3, "BUS", ["ECON 101"]],
  ["MGT 101", "Principles of Management", 3, "BUS"],
  ["MGT 201", "Human Resource Management", 3, "BUS", ["MGT 101"]],
  ["MKT 201", "Principles of Marketing", 3, "BUS"],
  ["FIN 201", "Business Finance", 3, "BUS", ["ACC 101"]],
  ["BUS 301", "Business Law", 3, "BUS"],
  ["ENG 101", "English Composition I", 3, "AHU"],
  ["ENG 102", "English Composition II", 3, "AHU", ["ENG 101"]],
  ["COMM 101", "Introduction to Mass Communication", 3, "AHU"],
  ["COMM 201", "News Writing", 3, "AHU", ["ENG 101"]],
  ["COMM 202", "Broadcast Journalism", 3, "AHU", ["COMM 101"]],
  ["COMM 301", "Media Law and Ethics", 3, "AHU", ["COMM 101"]],
  ["HIST 101", "History of Liberia", 3, "AHU"],
  ["FREN 101", "French I", 3, "AHU"],
  ["PHIL 101", "Introduction to Philosophy", 3, "AHU"],
  ["SOC 101", "Introduction to Sociology", 3, "AHU"],
];

type ProgramDef = {
  code: string;
  name: string;
  dept: string;
  award: "Associate" | "Bachelor";
  credits: number;
  terms: number;
  students: number;
  /** Core courses by recommended term (1-based). */
  plan: string[][];
  electives: [code: string, term: number][];
};

const GENERAL = [
  ["ENG 101", "MATH 101"],
  ["ENG 102", "HIST 101"],
];

const PROGRAMS: ProgramDef[] = [
  {
    code: "BSC-CS",
    name: "Bachelor of Science in Computer Science",
    dept: "SCT",
    award: "Bachelor",
    credits: 120,
    terms: 8,
    students: 100,
    plan: [
      [...(GENERAL[0] ?? []), "CS 101"],
      [...(GENERAL[1] ?? []), "CS 102", "MATH 102"],
      ["CS 201", "MATH 201", "PHY 101"],
      ["CS 202", "STAT 201"],
      ["CS 301", "CS 302"],
      ["CS 303"],
    ],
    electives: [["MATH 202", 5]],
  },
  {
    code: "BBA-ACC",
    name: "Bachelor of Business Administration in Accounting",
    dept: "BUS",
    award: "Bachelor",
    credits: 120,
    terms: 8,
    students: 90,
    plan: [
      [...(GENERAL[0] ?? []), "ACC 101", "ECON 101"],
      [...(GENERAL[1] ?? []), "ACC 102", "ECON 102"],
      ["MGT 101", "ACC 201", "FIN 201"],
      ["MKT 201", "STAT 201"],
      ["ACC 301", "BUS 301"],
    ],
    electives: [["MGT 201", 4]],
  },
  {
    code: "BA-MC",
    name: "Bachelor of Arts in Mass Communication",
    dept: "AHU",
    award: "Bachelor",
    credits: 120,
    terms: 8,
    students: 60,
    plan: [
      [...(GENERAL[0] ?? []), "COMM 101", "SOC 101"],
      [...(GENERAL[1] ?? []), "COMM 201", "PHIL 101"],
      ["COMM 202", "FREN 101"],
      ["COMM 301"],
    ],
    electives: [["MKT 201", 4]],
  },
  {
    code: "AA-AGR",
    name: "Associate of Arts in General Agriculture",
    dept: "SCT",
    award: "Associate",
    credits: 60,
    terms: 4,
    students: 50,
    plan: [
      [...(GENERAL[0] ?? []), "BIO 101", "AGR 101"],
      [...(GENERAL[1] ?? []), "CHEM 101", "AGR 201"],
      ["AGR 202", "AGR 203"],
    ],
    electives: [["ECON 101", 3]],
  },
];

/** Courses the demo instructor teaches whenever they are offered. */
const DEMO_INSTRUCTOR_COURSES = new Set(["CS 101", "CS 102", "CS 201", "CS 202", "MATH 101"]);

const SCALE = [
  [90, "A", 4],
  [80, "B", 3],
  [70, "C", 2],
  [60, "D", 1],
  [0, "F", 0],
] as const;

function letterFor(score: number): { letter: string; points: number } {
  const [, letter, points] = SCALE.find(([min]) => score >= min) ?? SCALE[4];
  return { letter, points };
}

type CollegeStudent = NewStudent & {
  program: ProgramDef;
  /** Index into the past terms the student started in; 3 = starts this term. */
  cohort: number;
  ability: number;
};

/**
 * College: 3 departments, 4 programs, 40 courses with prerequisites, two academic
 * years (three finished semesters and the current one open for registration), 300
 * students with grades and fees.
 */
export async function seedCollege(ctx: SeedContext): Promise<void> {
  const { random } = ctx;
  await insert(ctx, "settings", [
    {
      org_name: "Corex Demo College",
      address: "Tubman Boulevard, Sinkor, Monrovia",
      phone: "+231 770 000 100",
      email: "registrar@college.demo.corex.test",
      letterhead_text: "Knowledge for service",
      config: { student_number_prefix: "CDC", max_credits_per_term: 18, min_credits_per_term: 6 },
    },
  ]);

  // Two academic years: last year's two semesters, this year's first (finished) and
  // second (current, registration open).
  const lastYear = await academicYear(ctx, day(-565), day(-215), false);
  const thisYear = await academicYear(ctx, day(-200), day(150), true);
  const past: Term[] = [
    await term(ctx, lastYear, "Semester 1", day(-565), day(-395)),
    await term(ctx, lastYear, "Semester 2", day(-380), day(-215)),
    await term(ctx, thisYear, "Semester 1", day(-200), day(-30)),
  ];
  const current = await term(ctx, thisYear, "Semester 2", day(-10), day(120), {
    is_current: true,
    registration_opens_on: day(-3),
    registration_closes_on: day(14),
  });

  const deptIds = new Map<string, string>(DEPARTMENTS.map(([code]) => [code, randomUUID()]));
  await insert(
    ctx,
    "departments",
    DEPARTMENTS.map(([code, name]) => ({ id: deptIds.get(code) ?? "", code, name })),
  );
  const courseIds = new Map<string, string>(COURSES.map(([code]) => [code, randomUUID()]));
  const courseId = (code: string) => {
    const id = courseIds.get(code);
    if (!id) throw new Error(`Unknown course ${code}`);
    return id;
  };
  await insert(
    ctx,
    "courses",
    COURSES.map(([code, title, c, dept]) => ({
      id: courseId(code),
      department_id: deptIds.get(dept) ?? "",
      code,
      title,
      credits: c,
      description: null,
    })),
  );
  await insert(
    ctx,
    "course_prerequisites",
    COURSES.flatMap(([code, , , , prereqs = []]) =>
      prereqs.map((p) => ({ course_id: courseId(code), prerequisite_course_id: courseId(p) })),
    ),
  );
  const programIds = new Map<string, string>(PROGRAMS.map((p) => [p.code, randomUUID()]));
  await insert(
    ctx,
    "programs",
    PROGRAMS.map((p) => ({
      id: programIds.get(p.code) ?? "",
      department_id: deptIds.get(p.dept) ?? "",
      name: p.name,
      code: p.code,
      award: p.award,
      total_credits_required: p.credits,
      duration_terms: p.terms,
    })),
  );
  await insert(
    ctx,
    "program_requirements",
    PROGRAMS.flatMap((p) => [
      ...p.plan.flatMap((codes, i) =>
        codes.map((code) => ({
          program_id: programIds.get(p.code) ?? "",
          course_id: courseId(code),
          requirement_type: "core",
          recommended_term: i + 1,
        })),
      ),
      ...p.electives.map(([code, t]) => ({
        program_id: programIds.get(p.code) ?? "",
        course_id: courseId(code),
        requirement_type: "elective",
        recommended_term: t,
      })),
    ]),
  );
  await insert(ctx, "grade_scale", [
    { min_score: 90, max_score: 100, letter: "A", grade_points: 4, is_passing: true },
    { min_score: 80, max_score: 89.99, letter: "B", grade_points: 3, is_passing: true },
    { min_score: 70, max_score: 79.99, letter: "C", grade_points: 2, is_passing: true },
    { min_score: 60, max_score: 69.99, letter: "D", grade_points: 1, is_passing: false },
    { min_score: 0, max_score: 59.99, letter: "F", grade_points: 0, is_passing: false },
  ]);

  // Students: cohorts that started three, one and zero semesters ago.
  const thisCalendarYear = yearOf(day());
  const students: CollegeStudent[] = [];
  for (const program of PROGRAMS) {
    for (let i = 0; i < program.students; i++) {
      const cohort = random.weighted([
        [0, 40],
        [2, 35],
        [3, 25],
      ] as const);
      students.push({
        ...person(random),
        id: randomUUID(),
        dateOfBirth: birthDate(random, thisCalendarYear - random.int(18, 26)),
        program,
        cohort,
        ability: random.normal(76, 10, 45, 98),
      });
    }
  }
  // The demo student: a Computer Science student in their fourth semester.
  const demoStudent = students.find((s) => s.program.code === "BSC-CS" && s.cohort === 0);
  if (!demoStudent) throw new Error("No student for the demo account");
  Object.assign(demoStudent, {
    firstName: "Ama",
    middleName: null,
    lastName: "Kpadeh",
    sex: "female",
    ability: 84,
    userId: userId(ctx, "student"),
    email: "student@college.demo.corex.test",
  });
  await insertStudents(ctx, random.shuffle(students));
  const termIds = [...past.map((t) => t.id), current.id];
  const enrollments = (cohorts: number[]) =>
    students
      .filter((s) => cohorts.includes(s.cohort))
      .map((s) => ({
        student_id: s.id,
        program_id: programIds.get(s.program.code) ?? "",
        start_term_id: termIds[s.cohort] ?? current.id,
        status: "active",
      }));
  // Last year's students first, so this year's first-semester fees bill only them.
  await insert(ctx, "program_enrollments", enrollments([0, 2]));

  // Instructors by department, the demo instructor for their own courses.
  const faculty = ["faculty1", "faculty2", "faculty3", "faculty4", "faculty5", "faculty6"];
  const instructorFor = (code: string, index: number) => {
    if (DEMO_INSTRUCTOR_COURSES.has(code)) return userId(ctx, "instructor");
    return userId(ctx, faculty[index % faculty.length] ?? "faculty1");
  };

  // Finished semesters: registrations approved, final grades locked.
  const registrar = userId(ctx, "registrar");
  for (const [termIndex, t] of past.entries()) {
    const takers = new Map<string, CollegeStudent[]>();
    for (const s of students) {
      const semester = termIndex - s.cohort + 1;
      if (semester < 1) continue;
      for (const code of s.program.plan[semester - 1] ?? []) {
        takers.set(code, [...(takers.get(code) ?? []), s]);
      }
    }
    await offerAndGrade(ctx, t, takers, courseId, instructorFor, registrar);
  }

  // The current semester: offerings for every student's next courses, plans in
  // every state.
  await insert(ctx, "program_enrollments", enrollments([3]));
  const next = new Map<string, CollegeStudent[]>();
  for (const s of students) {
    const semester = past.length - s.cohort + 1;
    for (const code of s.program.plan[semester - 1] ?? []) {
      next.set(code, [...(next.get(code) ?? []), s]);
    }
  }
  const offeringOf = new Map<string, string>();
  await insert(
    ctx,
    "course_offerings",
    [...next.keys()].sort().map((code, i) => {
      const id = randomUUID();
      offeringOf.set(code, id);
      return {
        id,
        course_id: courseId(code),
        term_id: current.id,
        section: "A",
        instructor_id: instructorFor(code, i),
        capacity: Math.max(30, Math.ceil(((next.get(code)?.length ?? 0) + 10) / 5) * 5),
        schedule_text: schedule(random),
        status: "open",
      };
    }),
  );
  const registrations: Row[] = [];
  for (const s of students) {
    if (s === demoStudent) continue;
    const state = random.weighted([
      ["approved", 25],
      ["submitted", 30],
      ["planned", 10],
      ["none", 35],
    ] as const);
    if (state === "none") continue;
    const semester = past.length - s.cohort + 1;
    for (const code of s.program.plan[semester - 1] ?? []) {
      registrations.push({
        student_id: s.id,
        offering_id: offeringOf.get(code) ?? "",
        status: state,
        submitted_at: state === "planned" ? null : `${day(-random.int(0, 3))}T10:00:00Z`,
        decided_by: state === "approved" ? registrar : null,
        decided_at: state === "approved" ? `${day(-random.int(0, 2))}T14:00:00Z` : null,
      });
    }
  }
  await insert(ctx, "course_registrations", registrations);

  // The demo instructor's current classes have assessments set up and a first quiz
  // scored, ready for the rest of the term.
  const demoOfferings = [...offeringOf.entries()].filter(([code]) =>
    DEMO_INSTRUCTOR_COURSES.has(code),
  );
  const approved = new Set(
    registrations
      .filter((r) => r.status === "approved")
      .map((r) => `${r.offering_id}|${r.student_id}`),
  );
  for (const [code, offeringId] of demoOfferings) {
    const assessments = [
      ["Quiz 1", 10, 20],
      ["Assignments", 20, 100],
      ["Midterm exam", 30, 100],
      ["Final exam", 40, 100],
    ] as const;
    const ids = assessments.map(() => randomUUID());
    await insert(
      ctx,
      "assessments",
      assessments.map(([name, weight, max], i) => ({
        id: ids[i] ?? "",
        offering_id: offeringId,
        name,
        weight_percent: weight,
        max_score: max,
      })),
    );
    const classList = (next.get(code) ?? []).filter((s) => approved.has(`${offeringId}|${s.id}`));
    await insert(
      ctx,
      "assessment_scores",
      classList.map((s) => ({
        id: randomUUID(),
        assessment_id: ids[0] ?? "",
        student_id: s.id,
        score: random.normal((s.ability / 100) * 20, 2, 6, 20, 0.5),
        entered_by: userId(ctx, "instructor"),
      })),
    );
  }

  // Fees: tuition in US dollars, registration and practicals in Liberian dollars.
  await insert(ctx, "fee_structures", [
    fee(thisYear, null, "all", "Tuition", 45_000, "USD"),
    fee(thisYear, null, "all", "Registration", 250_000, "LRD"),
    fee(thisYear, null, "BSC-CS", "Computer lab", 6_000, "USD"),
    fee(thisYear, null, "AA-AGR", "Field practicals", 400_000, "LRD"),
    fee(thisYear, current.id, "all", "Student activities", 150_000, "LRD"),
  ]);
  const lastSemester = past[2];
  if (lastSemester) await billTerm(ctx, lastSemester, { paid: 78, partial: 15, unpaid: 7 });
  await billTerm(ctx, current, { paid: 30, partial: 30, unpaid: 40 });

  await announcements(ctx, [
    {
      title: "Semester 2 registration is open",
      body: "Plan your courses and submit your plan before registration closes. Your plan is approved by the Registrar.",
      daysAgo: 3,
    },
    {
      title: "Semester 1 grades are published",
      body: "Final grades for Semester 1 are now on your grade report and transcript.",
      daysAgo: 20,
    },
    {
      title: "Fee payment deadline",
      body: "Semester 2 fees are due within 30 days of the start of the semester. Pay at the Business Office or by mobile money.",
      daysAgo: 8,
      roles: ["student", "bursar"],
    },
  ]);
}

function fee(
  yearId: string,
  termId: string | null,
  appliesTo: string,
  item: string,
  amountMinor: number,
  currency: "USD" | "LRD",
): Row {
  return {
    academic_year_id: yearId,
    term_id: termId,
    applies_to: appliesTo,
    item,
    amount_minor: amountMinor,
    currency,
  };
}

function schedule(random: Random): string {
  const days = random.pick(["Mon and Wed", "Tue and Thu", "Mon, Wed and Fri", "Saturday"]);
  return `${days}, ${random.pick(["8:00", "9:30", "11:00", "13:00", "14:30", "16:00"])}`;
}

async function offerAndGrade(
  ctx: SeedContext,
  t: Term,
  takers: Map<string, CollegeStudent[]>,
  courseId: (code: string) => string,
  instructorFor: (code: string, index: number) => string,
  registrar: string,
): Promise<void> {
  const { random } = ctx;
  const offerings: Row[] = [];
  const registrations: Row[] = [];
  const grades: Row[] = [];
  const submitted = `${addDays(t.endsOn, -5)}T12:00:00Z`;
  const locked = `${addDays(t.endsOn, 2)}T12:00:00Z`;
  for (const [i, code] of [...takers.keys()].sort().entries()) {
    const list = takers.get(code) ?? [];
    const offeringId = randomUUID();
    offerings.push({
      id: offeringId,
      course_id: courseId(code),
      term_id: t.id,
      section: "A",
      instructor_id: instructorFor(code, i),
      capacity: Math.max(30, Math.ceil((list.length + 5) / 5) * 5),
      schedule_text: schedule(random),
      status: "closed",
    });
    for (const s of list) {
      registrations.push({
        student_id: s.id,
        offering_id: offeringId,
        status: "approved",
        submitted_at: `${addDays(t.startsOn, -7)}T10:00:00Z`,
        decided_by: registrar,
        decided_at: `${addDays(t.startsOn, -5)}T10:00:00Z`,
      });
      const score = random.normal(s.ability, 8, 30, 99, 0.5);
      const { letter, points } = letterFor(score);
      grades.push({
        offering_id: offeringId,
        student_id: s.id,
        numeric_score: score,
        letter,
        grade_points: points,
        status: "locked",
        submitted_at: submitted,
        approved_by: registrar,
        approved_at: locked,
        locked_at: locked,
      });
    }
  }
  await insert(ctx, "course_offerings", offerings);
  await insert(ctx, "course_registrations", registrations);
  await insert(ctx, "final_grades", grades);
}

// High School ------------------------------------------------------------------------

const SUBJECTS = [
  ["MATH", "Mathematics"],
  ["ENG", "English"],
  ["LIT", "Literature"],
  ["FRE", "French"],
  ["GSCI", "General Science"],
  ["SOC", "Social Studies"],
  ["CIV", "Civics"],
  ["BIO", "Biology"],
  ["CHEM", "Chemistry"],
  ["PHY", "Physics"],
  ["GEO", "Geography"],
  ["ECON", "Economics"],
] as const;

type SubjectCode = (typeof SUBJECTS)[number][0];

const JUNIOR: SubjectCode[] = ["MATH", "ENG", "LIT", "FRE", "GSCI", "SOC", "CIV"];
const SENIOR: SubjectCode[] = ["MATH", "ENG", "LIT", "FRE", "BIO", "CHEM", "PHY", "GEO", "ECON"];

/** Who teaches a subject: the demo teacher has senior Mathematics. */
function teacherSlug(code: SubjectCode, grade: number): string {
  const senior = grade >= 10;
  switch (code) {
    case "MATH":
      return senior ? "teacher" : "faculty1";
    case "ENG":
    case "LIT":
      return "faculty2";
    case "FRE":
      return "faculty3";
    case "BIO":
    case "CHEM":
    case "PHY":
      return "faculty4";
    case "GSCI":
      return "faculty5";
    case "SOC":
    case "CIV":
      return "faculty6";
    case "GEO":
    case "ECON":
      return "faculty7";
  }
}

type HighSchoolStudent = NewStudent & {
  sectionId: string;
  grade: number;
  ability: number;
  presence: number;
};

/** Weekdays inside a term, counting back from yesterday. */
function schoolDays(terms: Term[], count: number): string[] {
  const out: string[] = [];
  for (let offset = -1; out.length < count && offset > -400; offset--) {
    const date = day(offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (terms.some((t) => date >= t.startsOn && date <= t.endsOn)) out.push(date);
  }
  return out;
}

/**
 * High School: Grades 7 to 12 with two sections each, 12 subjects, 360 students
 * with guardians, Semester 1 and the first period of Semester 2 published,
 * attendance for the last 60 school days and fees.
 */
export async function seedHighSchool(ctx: SeedContext): Promise<void> {
  const { random } = ctx;
  await insert(ctx, "settings", [
    {
      org_name: "Corex Demo High School",
      address: "Somalia Drive, Gardnersville",
      phone: "+231 770 000 200",
      email: "office@school.demo.corex.test",
      letterhead_text: "Discipline, knowledge and service",
      config: { student_number_prefix: "CDS", pass_mark: 70, show_rank: true },
    },
  ]);
  const yearId = await academicYear(ctx, day(-230), day(90), true);
  const semester1 = await term(ctx, yearId, "Semester 1", day(-230), day(-60));
  const semester2 = await term(ctx, yearId, "Semester 2", day(-50), day(80), { is_current: true });

  const periods: Record<string, string[]> = {};
  const periodRows: Row[] = [];
  for (const t of [semester1, semester2]) {
    periods[t.id] = [];
    for (const [number, name, exam] of [
      [1, "Period 1", false],
      [2, "Period 2", false],
      [3, "Period 3", false],
      [4, "Semester exam", true],
    ] as const) {
      const id = randomUUID();
      periods[t.id]?.push(id);
      periodRows.push({ id, term_id: t.id, number, name, is_exam: exam, weight: 1 });
    }
  }
  await insert(ctx, "marking_periods", periodRows);

  const levels = [7, 8, 9, 10, 11, 12].map((grade) => ({ grade, id: randomUUID() }));
  await insert(
    ctx,
    "grade_levels",
    levels.map((l) => ({ id: l.id, name: `Grade ${l.grade}`, sort_order: l.grade })),
  );
  const subjectIds = new Map<SubjectCode, string>(SUBJECTS.map(([code]) => [code, randomUUID()]));
  await insert(
    ctx,
    "subjects",
    SUBJECTS.map(([code, name]) => ({ id: subjectIds.get(code) ?? "", code, name })),
  );

  // Two sections per grade; the demo teacher is homeroom teacher of Grade 11 A.
  const homerooms = [
    "faculty1",
    "faculty2",
    "faculty3",
    "faculty4",
    "faculty5",
    "faculty6",
    "faculty7",
  ];
  const sections: { id: string; grade: number; name: string; homeroom: string }[] = [];
  for (const [i, level] of levels.entries()) {
    for (const [j, name] of ["A", "B"].entries()) {
      const homeroom =
        level.grade === 11 && name === "A"
          ? "teacher"
          : (homerooms[(i * 2 + j) % homerooms.length] ?? "faculty1");
      sections.push({
        id: randomUUID(),
        grade: level.grade,
        name,
        homeroom: userId(ctx, homeroom),
      });
    }
  }
  await insert(
    ctx,
    "sections",
    sections.map((sec) => ({
      id: sec.id,
      grade_level_id: levels.find((l) => l.grade === sec.grade)?.id ?? "",
      academic_year_id: yearId,
      name: sec.name,
      homeroom_teacher_id: sec.homeroom,
    })),
  );
  const sectionSubjects: { id: string; sectionId: string; code: SubjectCode; teacher: string }[] =
    [];
  for (const sec of sections) {
    for (const code of sec.grade >= 10 ? SENIOR : JUNIOR) {
      sectionSubjects.push({
        id: randomUUID(),
        sectionId: sec.id,
        code,
        teacher: userId(ctx, teacherSlug(code, sec.grade)),
      });
    }
  }
  await insert(
    ctx,
    "section_subjects",
    sectionSubjects.map((ss) => ({
      id: ss.id,
      section_id: ss.sectionId,
      subject_id: subjectIds.get(ss.code) ?? "",
      teacher_id: ss.teacher,
    })),
  );

  // 30 students per section, each with one or two guardians.
  const thisCalendarYear = yearOf(day());
  const students: HighSchoolStudent[] = [];
  for (const sec of sections) {
    for (let i = 0; i < 30; i++) {
      students.push({
        ...person(random),
        id: randomUUID(),
        dateOfBirth: birthDate(random, thisCalendarYear - sec.grade - 6 - random.int(0, 1)),
        sectionId: sec.id,
        grade: sec.grade,
        ability: random.normal(74, 11, 40, 98),
        presence: random.normal(0.93, 0.04, 0.75, 1, 0.01),
      });
    }
  }
  // The demo student (Grade 11 A) and a younger sibling (Grade 8 B) share the demo parent.
  const grade11A = sections.find((sec) => sec.grade === 11 && sec.name === "A");
  const grade8B = sections.find((sec) => sec.grade === 8 && sec.name === "B");
  const kebeh = students.find((s) => s.sectionId === grade11A?.id);
  const sibling = students.find((s) => s.sectionId === grade8B?.id);
  if (!kebeh || !sibling) throw new Error("No students for the demo accounts");
  Object.assign(kebeh, {
    firstName: "Kebeh",
    middleName: null,
    lastName: "Doe",
    sex: "female",
    ability: 85,
    userId: userId(ctx, "student"),
    email: "student@school.demo.corex.test",
  });
  Object.assign(sibling, { firstName: "Sando", middleName: null, lastName: "Doe", sex: "male" });
  await insertStudents(ctx, students);
  await insert(
    ctx,
    "student_placements",
    students.map((s) => ({ student_id: s.id, section_id: s.sectionId, academic_year_id: yearId })),
  );

  const guardians: Row[] = [];
  const links: Row[] = [];
  const parentId = randomUUID();
  guardians.push({
    id: parentId,
    first_name: "Comfort",
    last_name: "Doe",
    relationship: "Mother",
    phone: "+231 770 111 222",
    email: "parent@school.demo.corex.test",
    user_id: userId(ctx, "parent"),
  });
  for (const s of students) {
    if (s === kebeh || s === sibling) {
      links.push({ student_id: s.id, guardian_id: parentId, is_primary: true });
      continue;
    }
    const count = random.chance(0.45) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const relationship =
        i === 0
          ? random.weighted([
              ["Mother", 55],
              ["Father", 30],
              ["Aunt", 8],
              ["Grandmother", 7],
            ] as const)
          : random.pick(["Father", "Uncle", "Mother"] as const);
      const female = ["Mother", "Aunt", "Grandmother"].includes(relationship);
      const id = randomUUID();
      guardians.push({
        id,
        first_name: firstName(random, female ? "female" : "male"),
        last_name: ["Mother", "Father"].includes(relationship)
          ? s.lastName
          : person(random).lastName,
        relationship,
        phone: phone(random),
        email: null,
        user_id: null,
      });
      links.push({ student_id: s.id, guardian_id: id, is_primary: i === 0 });
    }
  }
  await insert(ctx, "guardians", guardians);
  await insert(ctx, "student_guardians", links);

  // Published results: every period of Semester 1 and Period 1 of Semester 2.
  const registrar = userId(ctx, "registrar");
  const published = [
    ...(periods[semester1.id] ?? []).map((id) => ({ id, at: addDays(semester1.endsOn, 3) })),
    { id: periods[semester2.id]?.[0] ?? "", at: day(-10) },
  ];
  const subjectBias = new Map<string, number>();
  const scores: Row[] = [];
  for (const s of students) {
    for (const ss of sectionSubjects.filter((x) => x.sectionId === s.sectionId)) {
      const key = `${s.id}|${ss.code}`;
      if (!subjectBias.has(key)) subjectBias.set(key, random.normal(0, 6, -15, 15));
      for (const p of published) {
        scores.push({
          id: randomUUID(),
          student_id: s.id,
          section_subject_id: ss.id,
          marking_period_id: p.id,
          score: random.normal(s.ability + (subjectBias.get(key) ?? 0), 6, 20, 100),
          status: "locked",
          entered_by: ss.teacher,
          submitted_at: `${addDays(p.at, -4)}T12:00:00Z`,
          approved_by: registrar,
          approved_at: `${p.at}T12:00:00Z`,
          locked_at: `${p.at}T12:00:00Z`,
        });
      }
    }
  }
  // Published scores bypass the teacher-only checks, as the approval functions do.
  await ctx.tx`select set_config('corex.grade_workflow', 'on', true)`;
  await insert(ctx, "period_scores", scores);
  await ctx.tx`select set_config('corex.grade_workflow', '', true)`;

  // Homeroom attendance for the last 60 school days (today is left for the demo).
  const attendance: Row[] = [];
  const homeroomOf = new Map(sections.map((sec) => [sec.id, sec.homeroom]));
  for (const date of schoolDays([semester1, semester2], 60)) {
    for (const s of students) {
      const present = random.chance(s.presence);
      attendance.push({
        id: randomUUID(),
        date,
        student_id: s.id,
        class_ref_type: "section",
        class_ref_id: s.sectionId,
        status: present
          ? random.chance(0.05)
            ? "late"
            : "present"
          : random.chance(0.3)
            ? "excused"
            : "absent",
        recorded_by: homeroomOf.get(s.sectionId) ?? null,
        note: null,
      });
    }
  }
  await insert(ctx, "attendance", attendance);

  await insert(ctx, "fee_structures", [
    ...levels.map((l) =>
      fee(yearId, null, `Grade ${l.grade}`, "Tuition", l.grade >= 10 ? 22_500 : 17_500, "USD"),
    ),
    ...levels
      .filter((l) => l.grade >= 10)
      .map((l) => fee(yearId, null, `Grade ${l.grade}`, "Science lab", 2_500, "USD")),
    fee(yearId, null, "all", "Development fee", 150_000, "LRD"),
  ]);
  await billTerm(ctx, semester1, { paid: 75, partial: 18, unpaid: 7 });
  await billTerm(ctx, semester2, { paid: 30, partial: 35, unpaid: 35 });

  await announcements(ctx, [
    {
      title: "Period 1 results are published",
      body: "Semester 2 Period 1 scores are now on report cards. Parents can view them in the portal.",
      daysAgo: 10,
    },
    {
      title: "PTA meeting on Saturday",
      body: "All parents and guardians are invited to the PTA meeting in the school hall at 10:00.",
      daysAgo: 4,
      roles: ["parent", "teacher"],
    },
    {
      title: "Semester 2 fees",
      body: "Semester 2 fees were due 30 days after the start of the semester. Please settle balances at the Business Office.",
      daysAgo: 15,
      roles: ["parent", "student", "bursar"],
    },
  ]);
}
