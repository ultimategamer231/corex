// SCH-04 (High School): semester averages against hand-computed fixtures.
import { describe, expect, it } from "vitest";
import { isComplete, type MarkingPeriod, overallAverage, ranks, semesterAverage } from "./averages";

const periods: MarkingPeriod[] = [
  { id: "p1", number: 1, name: "Period 1", isExam: false, weight: "1.00" },
  { id: "p2", number: 2, name: "Period 2", isExam: false, weight: "1.00" },
  { id: "p3", number: 3, name: "Period 3", isExam: false, weight: "1.00" },
  { id: "ex", number: 4, name: "Semester exam", isExam: true, weight: "1.00" },
];
const scores = (p1: number, p2: number, p3: number | null, ex: number) => [
  { markingPeriodId: "p1", score: p1 },
  { markingPeriodId: "p2", score: p2 },
  ...(p3 === null ? [] : [{ markingPeriodId: "p3", score: p3 }]),
  { markingPeriodId: "ex", score: ex },
];

describe("semester average", () => {
  it("averages the periods and the exam with equal weights", () => {
    // (80 + 75 + 90 + 70) / 4 = 78.75
    expect(semesterAverage(periods, scores(80, 75, 90, 70))).toBe(78.75);
  });

  it("uses the configured weights", () => {
    const heavyExam = periods.map((p) => (p.isExam ? { ...p, weight: "2.00" } : p));
    // (80 + 75 + 90 + 70 × 2) / 5 = 77.00
    expect(semesterAverage(heavyExam, scores(80, 75, 90, 70))).toBe(77);
  });

  it("averages only the periods with scores and reports the term incomplete", () => {
    // (80 + 75 + 70) / 3 = 75.00
    expect(semesterAverage(periods, scores(80, 75, null, 70))).toBe(75);
    expect(isComplete(periods, scores(80, 75, null, 70))).toBe(false);
    expect(isComplete(periods, scores(80, 75, 90, 70))).toBe(true);
    expect(semesterAverage(periods, [])).toBeNull();
  });

  it("rounds half up to two decimals", () => {
    // (85 + 86 + 86) / 3 = 85.666… → 85.67; (70.5 + 70.5 + 70.5 + 70.52) / 4 = 70.505 → 70.51
    expect(
      semesterAverage(periods.slice(0, 3), [
        { markingPeriodId: "p1", score: 85 },
        { markingPeriodId: "p2", score: 86 },
        { markingPeriodId: "p3", score: 86 },
      ]),
    ).toBe(85.67);
    expect(
      semesterAverage(periods, [
        { markingPeriodId: "p1", score: "70.50" },
        { markingPeriodId: "p2", score: "70.50" },
        { markingPeriodId: "p3", score: "70.50" },
        { markingPeriodId: "ex", score: "70.52" },
      ]),
    ).toBe(70.51);
  });
});

describe("overall average and rank", () => {
  it("weights every subject equally", () => {
    // (78.75 + 77 + 64.5) / 3 = 73.4166… → 73.42
    expect(overallAverage([78.75, 77, 64.5, null])).toBe(73.42);
    expect(overallAverage([null])).toBeNull();
  });

  it("gives equal averages the same rank", () => {
    const result = ranks(
      new Map([
        ["a", 80],
        ["b", 91.5],
        ["c", 80],
        ["d", 70],
        ["e", null],
      ]),
    );
    expect(Object.fromEntries(result)).toEqual({ b: 1, a: 2, c: 2, d: 4 });
  });
});
