import { Button, buttonVariants } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { Section } from "@/components/section";
import { loadAcademicRecord } from "@/lib/academic";
import { money, personName, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { BURSAR, OFFICE, REGISTRAR } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import type { SchoolDb } from "@/lib/supabase";

export const metadata: Metadata = { title: "Reports" };

type Props = { searchParams: Promise<{ q?: string; from?: string; to?: string }> };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const METHOD = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank transfer",
  other: "Other",
} as const;

export default async function ReportsPage({ searchParams }: Props) {
  const { supabase, member } = await requireRoles([...OFFICE, "student"]);
  const params = await searchParams;
  const registrar = memberHas(member, REGISTRAR);
  const bursar = memberHas(member, BURSAR);
  return (
    <>
      <PageHeader title="Reports" />
      <div className="flex flex-col gap-10">
        {registrar ? <TranscriptFinder db={supabase} q={params.q} /> : null}
        {bursar ? <PaymentsReport db={supabase} from={params.from} to={params.to} /> : null}
        {!registrar && !bursar ? <MyDocuments db={supabase} userId={member.userId} /> : null}
      </div>
    </>
  );
}

async function TranscriptFinder({ db, q: raw }: { db: SchoolDb; q?: string }) {
  const q = (raw ?? "")
    .replace(/[,()*%\\]/g, " ")
    .trim()
    .slice(0, 80);
  const students = q
    ? rows(
        await db
          .from("students")
          .select("id, student_number, first_name, middle_name, last_name")
          .or(`first_name.ilike.*${q}*,last_name.ilike.*${q}*,student_number.ilike.*${q}*`)
          .order("last_name")
          .limit(25),
      )
    : [];
  return (
    <Section
      title="Transcripts and grade reports"
      id="transcripts"
      description="Find a student to print their transcript."
    >
      <form className="flex flex-wrap items-end gap-3" role="search" aria-label="Find a student">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">Name or student number</Label>
          <Input id="q" name="q" type="search" defaultValue={q} />
        </div>
        <Button type="submit" variant="secondary">
          Find
        </Button>
      </form>
      {q && students.length === 0 ? <p className="text-muted">No students match.</p> : null}
      {students.length > 0 ? (
        <TableScroll label="Students found">
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>
                  <span className="sr-only">Documents</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <span className="font-semibold">{personName(s)}</span>
                    <p className="text-sm text-muted">{s.student_number}</p>
                  </Td>
                  <Td className="text-right">
                    <a
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                      href={`/reports/transcript/${s.id}`}
                    >
                      Transcript<span className="sr-only"> for {personName(s)}</span>
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
    </Section>
  );
}

async function PaymentsReport({
  db,
  from: rawFrom,
  to: rawTo,
}: {
  db: SchoolDb;
  from?: string;
  to?: string;
}) {
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const to = rawTo && ISO.test(rawTo) ? rawTo : today;
  const from = rawFrom && ISO.test(rawFrom) ? rawFrom : `${to.slice(0, 8)}01`;
  const payments = rows(
    await db
      .from("payments")
      .select("amount_minor, currency, method")
      .eq("status", "posted")
      .gte("received_at", `${from}T00:00:00Z`)
      .lte("received_at", `${to}T23:59:59Z`),
  );
  const totals = new Map<string, number>();
  for (const p of payments) {
    const key = `${p.currency}|${p.method}`;
    totals.set(key, (totals.get(key) ?? 0) + p.amount_minor);
  }
  const byCurrency = new Map<string, number>();
  for (const p of payments)
    byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + p.amount_minor);
  return (
    <Section
      title="Fees collected"
      id="collected"
      description="Posted payments in the period, by currency and method. Voided payments are left out."
    >
      <form className="flex flex-wrap items-end gap-3" aria-label="Choose a period">
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} max={today} />
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} max={today} />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>
      {payments.length === 0 ? (
        <p className="text-muted">No payments in this period.</p>
      ) : (
        <TableScroll label="Fees collected">
          <Table>
            <thead>
              <tr>
                <Th>Currency</Th>
                <Th>Method</Th>
                <Th className="text-right">Collected</Th>
              </tr>
            </thead>
            <tbody>
              {[...totals.entries()].map(([key, amount]) => {
                const [currency = "USD", method = "other"] = key.split("|");
                return (
                  <tr key={key}>
                    <Td>{currency}</Td>
                    <Td>{METHOD[method as keyof typeof METHOD] ?? method}</Td>
                    <Td className="text-right whitespace-nowrap">{money(amount, currency)}</Td>
                  </tr>
                );
              })}
              {[...byCurrency.entries()].map(([currency, amount]) => (
                <tr key={`total-${currency}`} className="font-bold">
                  <Td>{currency}</Td>
                  <Td>Total</Td>
                  <Td className="text-right whitespace-nowrap">{money(amount, currency)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </Section>
  );
}

async function MyDocuments({ db, userId }: { db: SchoolDb; userId: string }) {
  const { data: student, error } = await db
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!student) return <p className="text-muted">Your student record is not linked yet.</p>;
  const record = await loadAcademicRecord(db, student.id);
  return (
    <Section title="My documents" id="documents">
      <div className="flex flex-wrap gap-2">
        <a
          className={buttonVariants({ variant: "primary" })}
          href={`/reports/transcript/${student.id}`}
        >
          Transcript
        </a>
        {record.terms.map((t) => (
          <a
            key={t.termId}
            className={buttonVariants({ variant: "secondary" })}
            href={`/reports/grade-report/${student.id}/${t.termId}`}
          >
            Grade report, {t.termName}
          </a>
        ))}
      </div>
    </Section>
  );
}
