// SCH-04: GPA and CGPA against hand-computed fixtures across three terms, with a
// repeated course and a withdrawal that carries no grade points.
import { describe, expect, it } from "vitest";
import { academicRecord, countedAttempts, creditsEarned, gpa, type GradeRecord } from "./gpa";

const terms = {
  t1: { termId: "t1", termName: "2024/2025 Semester 1", termStartsOn: "2024-09-02" },
  t2: { termId: "t2", termName: "2024/2025 Semester 2", termStartsOn: "2025-02-03" },
  t3: { termId: "t3", termName: "2025/2026 Semester 1", termStartsOn: "2025-09-01" },
};

function grade(
  term: keyof typeof terms,
  code: string,
  credits: number,
  letter: string,
  points: string | null,
  passing: boolean,
): GradeRecord {
  return {
    ...terms[term],
    courseId: code,
    code,
    title: code,
    credits,
    numericScore: null,
    letter,
    gradePoints: points,
    isPassing: passing,
  };
}

const records: GradeRecord[] = [
  // Term 1: (0×3 + 3×3 + 4×2) / 8 = 17/8 = 2.125 → 2.13
  grade("t1", "MATH 101", 3, "F", "0.00", false),
  grade("t1", "ENG 101", 3, "B", "3.00", true),
  grade("t1", "HIS 101", 2, "A", "4.00", true),
  // Term 2: (3×3 + 2×4) / 7 = 17/7 = 2.428… → 2.43; the withdrawal is excluded
  grade("t2", "MATH 101", 3, "B", "3.00", true),
  grade("t2", "PHY 101", 4, "C", "2.00", true),
  grade("t2", "SOC 101", 3, "W", null, false),
  // Term 3: (4×3 + 4×3 + 1×3) / 9 = 27/9 = 3.00
  grade("t3", "MATH 201", 3, "A", "4.00", true),
  grade("t3", "CS 101", 3, "A", "4.00", true),
  grade("t3", "ENG 201", 3, "D", "1.00", false),
];

describe("term GPA", () => {
  it("matches the hand-computed values", () => {
    const record = academicRecord(records);
    expect(record.terms.map((t) => [t.termName, t.gpa, t.creditsEarned])).toEqual([
      ["2024/2025 Semester 1", 2.13, 5],
      ["2024/2025 Semester 2", 2.43, 7],
      ["2025/2026 Semester 1", 3.0, 6],
    ]);
  });

  it("is null when no course carries grade points", () => {
    expect(gpa([grade("t2", "SOC 101", 3, "W", null, false)])).toBeNull();
  });
});

describe("CGPA", () => {
  it("counts only the latest attempt of a repeated course by default", () => {
    // MATH 101 counts once (B): (9 + 9 + 8 + 8 + 12 + 12 + 3) / 21 = 61/21 = 2.904… → 2.90
    const record = academicRecord(records);
    expect(record.cgpa).toBe(2.9);
    // Passing credits over counted attempts: 3 + 3 + 2 + 4 + 3 + 3 = 18
    expect(record.creditsEarned).toBe(18);
    expect([...record.superseded].map((r) => `${r.code} ${r.termId}`)).toEqual(["MATH 101 t1"]);
  });

  it("can count every attempt", () => {
    // Adds the failed MATH 101 (0 × 3): 61/24 = 2.541… → 2.54
    expect(academicRecord(records, "all").cgpa).toBe(2.54);
  });

  it("can count the best attempt", () => {
    const repeated = [
      grade("t1", "ART 101", 2, "B", "3.00", true),
      grade("t2", "ART 101", 2, "C", "2.00", true),
    ];
    expect(countedAttempts(repeated, "best").map((r) => r.letter)).toEqual(["B"]);
    expect(countedAttempts(repeated, "latest").map((r) => r.letter)).toEqual(["C"]);
  });

  it("rounds half up, never half to even", () => {
    // 17/8 = 2.125 → 2.13 (half to even would give 2.12)
    expect(gpa(records.filter((r) => r.termId === "t1"))).toBe(2.13);
    // 13/4 = 3.25 exactly stays 3.25
    expect(
      gpa([
        grade("t1", "A1", 1, "A", "4.00", true),
        grade("t1", "B1", 1, "B", "3.00", true),
        grade("t1", "B2", 2, "B", "3.00", true),
      ]),
    ).toBe(3.25);
  });

  it("credits earned ignore failed courses", () => {
    expect(creditsEarned(records.filter((r) => r.termId === "t3"))).toBe(6);
  });
});
