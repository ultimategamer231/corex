import { configNumber } from "@corex/core/settings";
import { Badge } from "@corex/ui/components/badge";
import { Button, buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import { cn } from "@corex/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { formatScore, overallAverage, semesterAverage } from "@/lib/averages";
import { requireEdition } from "@/lib/edition";
import { personName } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { REGISTRAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { applyPromotions, saveDecisions } from "./actions";

export const metadata: Metadata = { title: "Promotions" };

type Props = { searchParams: Promise<{ year?: string; section?: string }> };

export default async function PromotionsPage({ searchParams }: Props) {
  const { supabase } = await requireRoles(REGISTRAR);
  requireEdition("highschool");
  const settings = await getSettings();
  const passMark = configNumber(settings, "pass_mark", 70);
  const params = await searchParams;
  const years = rows(
    await supabase
      .from("academic_years")
      .select("id, name, is_current, starts_on")
      .order("starts_on", { ascending: false }),
  );
  const year =
    years.find((y) => y.id === params.year) ?? years.find((y) => y.is_current) ?? years[0];
  if (!year) return <PageHeader title="Promotions" description="Add an academic year first." />;
  const laterYears = years.filter((y) => y.starts_on > year.starts_on).reverse();

  const sections = rows(
    await supabase
      .from("sections")
      .select("id, name, grade_levels(name, sort_order), student_placements(id)")
      .eq("academic_year_id", year.id),
  ).sort(
    (a, b) =>
      (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
      a.name.localeCompare(b.name),
  );
  const section = sections.find((s) => s.id === params.section) ?? sections[0];

  // Year average per student: the mean of each term's overall average, from locked scores.
  const [placed, terms, subjects, decisions] = section
    ? await Promise.all([
        supabase
          .from("student_placements")
          .select("student_id, students(student_number, first_name, middle_name, last_name)")
          .eq("section_id", section.id)
          .then(rows),
        supabase
          .from("terms")
          .select("id, marking_periods(id, number, name, is_exam, weight)")
          .eq("academic_year_id", year.id)
          .then(rows),
        supabase.from("section_subjects").select("id").eq("section_id", section.id).then(rows),
        supabase
          .from("promotions")
          .select("student_id, decision, note")
          .eq("academic_year_id", year.id)
          .then(rows),
      ])
    : [[], [], [], []];
  const scores = subjects.length
    ? rows(
        await supabase
          .from("period_scores")
          .select("student_id, section_subject_id, marking_period_id, score")
          .eq("status", "locked")
          .in(
            "section_subject_id",
            subjects.map((s) => s.id),
          ),
      )
    : [];
  const yearAverage = (studentId: string) => {
    const own = scores.filter((s) => s.student_id === studentId);
    const termAverages = terms.map((t) => {
      const periods = t.marking_periods.map((p) => ({
        id: p.id,
        number: p.number,
        name: p.name,
        isExam: p.is_exam,
        weight: p.weight,
      }));
      return overallAverage(
        subjects.map((ss) =>
          semesterAverage(
            periods,
            own
              .filter((s) => s.section_subject_id === ss.id)
              .map((s) => ({ markingPeriodId: s.marking_period_id, score: s.score })),
          ),
        ),
      );
    });
    return overallAverage(termAverages);
  };
  placed.sort((a, b) => (a.students?.last_name ?? "").localeCompare(b.students?.last_name ?? ""));
  const decided = new Map(decisions.map((d) => [d.student_id, d]));

  return (
    <>
      <PageHeader
        title="Promotions"
        description={`Year-end decisions for ${year.name}. Pass mark ${passMark}.`}
      />
      <form className="mb-6 flex flex-wrap items-end gap-3" aria-label="Choose a year">
        <div className="flex w-60 flex-col gap-1.5">
          <Label htmlFor="year">Academic year</Label>
          <Select id="year" name="year" defaultValue={year.id}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>
      {sections.length === 0 ? (
        <p className="text-muted">No sections in this year.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <nav aria-label="Sections" className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <Link
                key={s.id}
                href={`/promotions?year=${year.id}&section=${s.id}`}
                aria-current={s.id === section?.id ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    variant: s.id === section?.id ? "primary" : "secondary",
                    size: "sm",
                  }),
                )}
              >
                {s.grade_levels?.name} {s.name}
              </Link>
            ))}
          </nav>
          {section ? (
            <Section
              title={`${section.grade_levels?.name ?? ""} ${section.name}`}
              id="decisions"
              description="The suggestion follows the year average and the pass mark; change it where needed."
            >
              {placed.length === 0 ? (
                <p className="text-muted">No students in this section.</p>
              ) : (
                <ActionForm
                  action={saveDecisions}
                  resetOnSuccess={false}
                  aria-label="Promotion decisions"
                >
                  <input type="hidden" name="academic_year_id" value={year.id} />
                  <TableScroll label="Promotion decisions">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Student</Th>
                          <Th>Year average</Th>
                          <Th>Decision</Th>
                          <Th>Note</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {placed.map((p) => {
                          const name = p.students ? personName(p.students) : "";
                          const average = yearAverage(p.student_id);
                          const saved = decided.get(p.student_id);
                          const suggested =
                            average === null ? "" : average >= passMark ? "promoted" : "repeat";
                          return (
                            <tr key={p.student_id}>
                              <Td>
                                <span className="font-semibold whitespace-nowrap">{name}</span>
                                <p className="text-sm text-muted">{p.students?.student_number}</p>
                              </Td>
                              <Td>
                                {formatScore(average)}{" "}
                                {average !== null && average < passMark ? (
                                  <Badge variant="danger">Below pass mark</Badge>
                                ) : null}
                              </Td>
                              <Td>
                                <Select
                                  name={`decision_${p.student_id}`}
                                  defaultValue={saved?.decision ?? suggested}
                                  aria-label={`Decision for ${name}`}
                                  className="w-40"
                                >
                                  <option value="">Not decided</option>
                                  <option value="promoted">Promoted</option>
                                  <option value="conditional">Conditional</option>
                                  <option value="repeat">Repeat</option>
                                </Select>
                              </Td>
                              <Td>
                                <Input
                                  name={`note_${p.student_id}`}
                                  defaultValue={saved?.note ?? ""}
                                  aria-label={`Note for ${name}`}
                                  className="w-56"
                                />
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </TableScroll>
                  <div>
                    <SubmitButton>Save decisions</SubmitButton>
                  </div>
                </ActionForm>
              )}
            </Section>
          ) : null}
          <Section
            title="Place students in the next year"
            id="apply"
            description="Promoted and conditional students move to the next grade level, repeating students stay; each goes to the section with the same name. Students promoted from the top grade are marked graduated."
          >
            {laterYears.length === 0 ? (
              <p className="text-muted">Add next year and its sections first.</p>
            ) : (
              <ActionForm
                action={applyPromotions}
                resetOnSuccess={false}
                aria-label="Place students in the next year"
                className="max-w-md"
              >
                <input type="hidden" name="from_year_id" value={year.id} />
                <FormField name="to_year_id" label="Next year" required>
                  <Select defaultValue={laterYears[0]?.id ?? ""}>
                    {laterYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div>
                  <SubmitButton variant="accent">Place students</SubmitButton>
                </div>
              </ActionForm>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
