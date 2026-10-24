// GPA and credits (SPEC.md 7.3, SCH-04). Pure functions over locked final grades.
// Grade points are kept in hundredths (integers) so sums are exact; results are
// rounded half up to two decimals only at the end.

export type RepeatPolicy = "latest" | "best" | "all";

export type GradeRecord = {
  courseId: string;
  code: string;
  title: string;
  credits: number;
  termId: string;
  termName: string;
  /** ISO date the term starts; orders attempts of a repeated course. */
  termStartsOn: string;
  numericScore: string | null;
  letter: string | null;
  /** Null for marks that do not count (for example a withdrawal). */
  gradePoints: string | null;
  isPassing: boolean;
};

function hundredths(points: string): number {
  return Math.round(Number(points) * 100);
}

/** Σ(grade points × credits) / Σ(credits), rounded half up to 2 places; null when nothing counts. */
export function gpa(records: readonly GradeRecord[]): number | null {
  let weighted = 0;
  let credits = 0;
  for (const r of records) {
    if (r.gradePoints === null) continue;
    weighted += hundredths(r.gradePoints) * r.credits;
    credits += r.credits;
  }
  if (credits === 0) return null;
  // weighted / credits is in hundredths; round half up to a whole hundredth.
  return Math.floor((weighted * 2 + credits) / (credits * 2)) / 100;
}

export function formatGpa(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

/**
 * The attempts that count towards CGPA and credits: for a repeated course the
 * latest attempt (default), the best one, or all of them (settings.config.repeat_policy).
 */
export function countedAttempts(
  records: readonly GradeRecord[],
  policy: RepeatPolicy = "latest",
): GradeRecord[] {
  if (policy === "all") return [...records];
  const byCourse = new Map<string, GradeRecord>();
  for (const r of records) {
    const current = byCourse.get(r.courseId);
    if (!current || prefer(r, current, policy)) byCourse.set(r.courseId, r);
  }
  return records.filter((r) => byCourse.get(r.courseId) === r);
}

function prefer(candidate: GradeRecord, current: GradeRecord, policy: "latest" | "best"): boolean {
  if (policy === "best") {
    const a = candidate.gradePoints === null ? -1 : hundredths(candidate.gradePoints);
    const b = current.gradePoints === null ? -1 : hundredths(current.gradePoints);
    if (a !== b) return a > b;
  }
  return candidate.termStartsOn > current.termStartsOn;
}

export function creditsEarned(records: readonly GradeRecord[]): number {
  return records.reduce((sum, r) => sum + (r.isPassing ? r.credits : 0), 0);
}

export type TermSummary = {
  termId: string;
  termName: string;
  termStartsOn: string;
  records: GradeRecord[];
  gpa: number | null;
  creditsEarned: number;
};

export type AcademicRecord = {
  terms: TermSummary[];
  cgpa: number | null;
  creditsEarned: number;
  /** Attempts replaced by another attempt of the same course under the policy. */
  superseded: Set<GradeRecord>;
};

/** Term-by-term results with term GPA, then CGPA and credits over the counted attempts. */
export function academicRecord(
  records: readonly GradeRecord[],
  policy: RepeatPolicy = "latest",
): AcademicRecord {
  const terms = new Map<string, TermSummary>();
  for (const r of [...records].sort(
    (a, b) => a.termStartsOn.localeCompare(b.termStartsOn) || a.code.localeCompare(b.code),
  )) {
    let term = terms.get(r.termId);
    if (!term) {
      term = {
        termId: r.termId,
        termName: r.termName,
        termStartsOn: r.termStartsOn,
        records: [],
        gpa: null,
        creditsEarned: 0,
      };
      terms.set(r.termId, term);
    }
    term.records.push(r);
  }
  for (const term of terms.values()) {
    term.gpa = gpa(term.records);
    term.creditsEarned = creditsEarned(term.records);
  }
  const counted = countedAttempts(records, policy);
  const countedSet = new Set(counted);
  return {
    terms: [...terms.values()],
    cgpa: gpa(counted),
    creditsEarned: creditsEarned(counted),
    superseded: new Set(records.filter((r) => !countedSet.has(r))),
  };
}

export function parseRepeatPolicy(value: unknown): RepeatPolicy {
  return value === "best" || value === "all" ? value : "latest";
}
