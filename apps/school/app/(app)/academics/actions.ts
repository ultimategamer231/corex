"use server";

import { z } from "zod";
import {
  ActionError,
  isoDate,
  must,
  optionalText,
  requiredText,
  runAction,
  uuid,
} from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { REGISTRAR } from "@/lib/roles";

const opts = <T>(schema: z.ZodType<T>) => ({
  roles: REGISTRAR,
  schema,
  revalidate: ["/academics"],
});
const flag = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "yes");
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date");
const wholeNumber = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Enter ${label}` })
    .int(`Enter a whole number for ${label}`)
    .min(min, `${label[0]?.toUpperCase()}${label.slice(1)} must be at least ${min}`)
    .max(max, `${label[0]?.toUpperCase()}${label.slice(1)} must be at most ${max}`);

// Academic calendar -------------------------------------------------------------

const yearSchema = z
  .object({
    name: requiredText("the year name", 20),
    starts_on: isoDate("the start date"),
    ends_on: isoDate("the end date"),
    is_current: flag,
  })
  .refine((d) => d.ends_on > d.starts_on, {
    path: ["ends_on"],
    message: "The end date must be after the start",
  });

export async function createYear(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(yearSchema), async (d, { supabase }) => {
    if (d.is_current)
      must(
        await supabase.from("academic_years").update({ is_current: false }).eq("is_current", true),
      );
    must(await supabase.from("academic_years").insert(d));
    return `Academic year ${d.name} added.`;
  });
}

const termSchema = z
  .object({
    academic_year_id: uuid("the academic year"),
    name: requiredText("the term name", 40),
    starts_on: isoDate("the start date"),
    ends_on: isoDate("the end date"),
    registration_opens_on: optionalDate,
    registration_closes_on: optionalDate,
    is_current: flag,
  })
  .refine((d) => d.ends_on > d.starts_on, {
    path: ["ends_on"],
    message: "The end date must be after the start",
  })
  .refine((d) => (d.registration_opens_on === null) === (d.registration_closes_on === null), {
    path: ["registration_closes_on"],
    message: "Give both registration dates, or neither",
  })
  .refine(
    (d) =>
      !d.registration_opens_on ||
      !d.registration_closes_on ||
      d.registration_closes_on >= d.registration_opens_on,
    { path: ["registration_closes_on"], message: "Registration must close on or after it opens" },
  );

export async function createTerm(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(termSchema), async (d, { supabase }) => {
    if (d.is_current)
      must(await supabase.from("terms").update({ is_current: false }).eq("is_current", true));
    must(await supabase.from("terms").insert(d));
    return `Term ${d.name} added.`;
  });
}

const termWindowSchema = z
  .object({
    id: uuid(),
    registration_opens_on: optionalDate,
    registration_closes_on: optionalDate,
  })
  .refine((d) => (d.registration_opens_on === null) === (d.registration_closes_on === null), {
    path: ["registration_closes_on"],
    message: "Give both registration dates, or neither",
  })
  .refine(
    (d) =>
      !d.registration_opens_on ||
      !d.registration_closes_on ||
      d.registration_closes_on >= d.registration_opens_on,
    { path: ["registration_closes_on"], message: "Registration must close on or after it opens" },
  );

export async function updateRegistrationWindow(
  _p: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(formData, opts(termWindowSchema), async ({ id, ...window }, { supabase }) => {
    must(await supabase.from("terms").update(window).eq("id", id));
    return "Registration dates saved.";
  });
}

export async function makeTermCurrent(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(z.object({ id: uuid() })), async ({ id }, { supabase }) => {
    const term = must(
      await supabase.from("terms").select("academic_year_id").eq("id", id).single(),
    );
    must(await supabase.from("terms").update({ is_current: false }).eq("is_current", true));
    must(await supabase.from("terms").update({ is_current: true }).eq("id", id));
    must(
      await supabase.from("academic_years").update({ is_current: false }).eq("is_current", true),
    );
    must(
      await supabase
        .from("academic_years")
        .update({ is_current: true })
        .eq("id", term.academic_year_id),
    );
    return "Current term changed.";
  });
}

// Departments, programs and courses ---------------------------------------------

const code = (label: string, pattern: RegExp, example: string) =>
  z
    .string({ error: `Enter ${label}` })
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(pattern, `Use a code like ${example}`));

const departmentSchema = z.object({
  name: requiredText("the department name", 120),
  code: code("a code", /^[A-Z0-9]{2,10}$/, "SCI"),
});

export async function createDepartment(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(departmentSchema), async (d, { supabase }) => {
    must(await supabase.from("departments").insert(d));
    return `Department ${d.name} added.`;
  });
}

const AWARDS = ["Certificate", "Diploma", "Associate", "Bachelor"] as const;
const programSchema = z.object({
  department_id: uuid("a department"),
  name: requiredText("the program name", 160),
  code: code("a code", /^[A-Z0-9-]{2,12}$/, "BSC-CS"),
  award: z.enum(AWARDS, { error: "Choose an award" }),
  total_credits_required: wholeNumber("the credits required", 1, 400),
  duration_terms: wholeNumber("the number of terms", 1, 20),
});

export async function createProgram(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(programSchema), async (d, { supabase }) => {
    must(await supabase.from("programs").insert(d));
    return `Program ${d.code} added.`;
  });
}

const requirementSchema = z.object({
  program_id: uuid(),
  course_id: uuid("a course"),
  requirement_type: z.enum(["core", "elective"], { error: "Choose core or elective" }),
  recommended_term: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 20),
      "Enter a term number from 1 to 20",
    ),
});

export async function addRequirement(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(requirementSchema), async (d, { supabase }) => {
    must(await supabase.from("program_requirements").insert(d));
    return "Requirement added.";
  });
}

export async function removeRequirement(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    opts(z.object({ program_id: uuid(), course_id: uuid() })),
    async (d, { supabase }) => {
      must(
        await supabase
          .from("program_requirements")
          .delete()
          .eq("program_id", d.program_id)
          .eq("course_id", d.course_id),
      );
      return "Requirement removed.";
    },
  );
}

const courseSchema = z.object({
  department_id: uuid("a department"),
  code: code("a course code", /^[A-Z]{2,6} ?[0-9]{2,4}[A-Z]?$/, "MATH 101"),
  title: requiredText("the course title", 160),
  credits: wholeNumber("the credits", 1, 12),
  description: optionalText,
});

export async function createCourse(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(courseSchema), async (d, { supabase }) => {
    must(await supabase.from("courses").insert(d));
    return `Course ${d.code} added.`;
  });
}

const prerequisiteSchema = z.object({
  course_id: uuid(),
  prerequisite_course_id: uuid("a prerequisite"),
});

export async function addPrerequisite(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(prerequisiteSchema), async (d, { supabase }) => {
    if (d.course_id === d.prerequisite_course_id)
      throw new ActionError("A course cannot be its own prerequisite.");
    must(await supabase.from("course_prerequisites").insert(d));
    return "Prerequisite added.";
  });
}

export async function removePrerequisite(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(prerequisiteSchema), async (d, { supabase }) => {
    must(
      await supabase
        .from("course_prerequisites")
        .delete()
        .eq("course_id", d.course_id)
        .eq("prerequisite_course_id", d.prerequisite_course_id),
    );
    return "Prerequisite removed.";
  });
}

// Offerings -----------------------------------------------------------------------

const offeringSchema = z.object({
  course_id: uuid("a course"),
  term_id: uuid("a term"),
  section: requiredText("a section", 10).transform((v) => v.toUpperCase()),
  instructor_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  capacity: wholeNumber("the capacity", 1, 1000),
  schedule_text: optionalText,
});

export async function createOffering(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(offeringSchema), async (d, { supabase }) => {
    must(await supabase.from("course_offerings").insert(d));
    return "Course offering added.";
  });
}

const offeringUpdateSchema = z.object({
  id: uuid(),
  instructor_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  capacity: wholeNumber("the capacity", 1, 1000),
  status: z.enum(["open", "closed"]),
  schedule_text: optionalText,
});

export async function updateOffering(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    opts(offeringUpdateSchema),
    async ({ id, ...fields }, { supabase }) => {
      must(await supabase.from("course_offerings").update(fields).eq("id", id));
      return "Offering saved.";
    },
  );
}

// Grade scale ---------------------------------------------------------------------

const score = (label: string) =>
  z.coerce
    .number({ error: `Enter ${label}` })
    .min(0, "Use 0 to 100")
    .max(100, "Use 0 to 100");
const gradeSchema = z
  .object({
    letter: requiredText("the letter", 4),
    min_score: score("the lowest score"),
    max_score: score("the highest score"),
    grade_points: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine(
        (v) => v === null || (v >= 0 && v <= 5),
        "Use 0 to 5, or leave empty for marks without points",
      ),
    is_passing: flag,
  })
  .refine((d) => d.max_score >= d.min_score, {
    path: ["max_score"],
    message: "Must be at least the lowest score",
  });

export async function addGrade(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(gradeSchema), async (d, { supabase }) => {
    must(await supabase.from("grade_scale").insert(d));
    return `Grade ${d.letter} added.`;
  });
}

export async function removeGrade(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, opts(z.object({ id: uuid() })), async ({ id }, { supabase }) => {
    must(await supabase.from("grade_scale").delete().eq("id", id));
    return "Grade removed.";
  });
}
