// High School averages (SPEC.md 7.4, SCH-04). Scores are 0 to 100 with two decimals;
// they are kept in hundredths so sums are exact, and results are rounded half up.

export type MarkingPeriod = {
  id: string;
  number: number;
  name: string;
  isExam: boolean;
  weight: number | string;
};
export type PeriodScore = { markingPeriodId: string; score: number | string };

const hundredths = (value: number | string) => Math.round(Number(value) * 100);

/** Weighted average Σ(score × weight) / Σ(weight) over the periods that have a score. */
export function semesterAverage(
  periods: readonly MarkingPeriod[],
  scores: readonly PeriodScore[],
): number | null {
  let weighted = 0;
  let weights = 0;
  for (const period of periods) {
    const s = scores.find((x) => x.markingPeriodId === period.id);
    if (!s) continue;
    const w = hundredths(period.weight);
    weighted += hundredths(s.score) * w;
    weights += w;
  }
  if (weights === 0) return null;
  // weighted / weights is in hundredths of a point; round half up to a whole hundredth.
  return Math.floor((weighted * 2 + weights) / (weights * 2)) / 100;
}

/** True when every marking period of the term has a score. */
export function isComplete(
  periods: readonly MarkingPeriod[],
  scores: readonly PeriodScore[],
): boolean {
  return periods.every((p) => scores.some((s) => s.markingPeriodId === p.id));
}

/** Mean of subject averages, each subject counting once; null when there are none. */
export function overallAverage(subjectAverages: readonly (number | null)[]): number | null {
  const values = subjectAverages
    .filter((v): v is number => v !== null)
    .map((v) => Math.round(v * 100));
  if (values.length === 0) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return Math.floor((total * 2 + values.length) / (values.length * 2)) / 100;
}

/** Rank in section, 1 for the highest; equal averages share a rank (1, 2, 2, 4). */
export function ranks(averages: ReadonlyMap<string, number | null>): Map<string, number> {
  const ranked = [...averages.entries()]
    .filter((e): e is [string, number] => e[1] !== null)
    .sort((a, b) => b[1] - a[1]);
  const result = new Map<string, number>();
  ranked.forEach(([id, value], i) => {
    const previous = ranked[i - 1];
    result.set(id, previous && previous[1] === value ? (result.get(previous[0]) ?? i + 1) : i + 1);
  });
  return result;
}

export function formatScore(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

/** Default marking periods per semester (SPEC.md 7.4): three periods and an exam, equal weights. */
export const DEFAULT_PERIODS = [
  { number: 1, name: "Period 1", isExam: false, weight: 1 },
  { number: 2, name: "Period 2", isExam: false, weight: 1 },
  { number: 3, name: "Period 3", isExam: false, weight: 1 },
  { number: 4, name: "Semester exam", isExam: true, weight: 1 },
] as const;
