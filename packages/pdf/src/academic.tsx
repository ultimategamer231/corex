import { Document, Page, Text, View } from "@react-pdf/renderer";
import { DocumentFooter } from "./document-footer";
import { docStyles } from "./invoice";
import { Letterhead, type LetterheadData } from "./letterhead";
import { pdfColors } from "./theme";

/** One course result as printed. Values arrive formatted; this package does no grading. */
export type CourseResultRow = {
  code: string;
  title: string;
  credits: number;
  score: string | null;
  letter: string | null;
  gradePoints: string | null;
  /** For example "Repeated later" when a later attempt replaces this one in the CGPA. */
  note?: string | null;
};

export type StudentHeading = {
  name: string;
  studentNumber: string;
  program: string;
};

export type GradeReportPdfData = {
  org: LetterheadData;
  timezone: string;
  /** Document reference, for example "GR-TC-2026-0001-S2". */
  documentNumber: string;
  student: StudentHeading;
  term: string;
  rows: CourseResultRow[];
  termGpa: string;
  cgpa: string;
  creditsEarned: number;
  generatedAt: Date;
};

export type TranscriptPdfData = {
  org: LetterheadData;
  timezone: string;
  documentNumber: string;
  student: StudentHeading;
  terms: { name: string; rows: CourseResultRow[]; gpa: string; creditsEarned: number }[];
  cgpa: string;
  creditsEarned: number;
  creditsRequired: number;
  generatedAt: Date;
};

const col = {
  code: { width: "14%" },
  title: { width: "40%" },
  num: { width: "11.5%", textAlign: "right" as const },
};

function StudentBlock({ student, extra }: { student: StudentHeading; extra: [string, string][] }) {
  const items: [string, string][] = [
    ["Student", student.name],
    ["Student number", student.studentNumber],
    ["Program", student.program],
    ...extra,
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
      {items.map(([label, value]) => (
        <View key={label} style={{ width: "50%", marginBottom: 8 }}>
          <Text style={docStyles.label}>{label}</Text>
          <Text style={docStyles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function ResultsTable({ rows }: { rows: CourseResultRow[] }) {
  return (
    <View>
      <View style={docStyles.tableHead} wrap={false}>
        <Text style={col.code}>Code</Text>
        <Text style={col.title}>Course</Text>
        <Text style={col.num}>Credits</Text>
        <Text style={col.num}>Score</Text>
        <Text style={col.num}>Grade</Text>
        <Text style={col.num}>Points</Text>
      </View>
      {rows.map((r) => (
        <View key={`${r.code}-${r.title}`} style={docStyles.tableRow} wrap={false}>
          <Text style={col.code}>{r.code}</Text>
          <View style={col.title}>
            <Text>{r.title}</Text>
            {r.note ? <Text style={{ fontSize: 8, color: pdfColors.muted }}>{r.note}</Text> : null}
          </View>
          <Text style={col.num}>{r.credits}</Text>
          <Text style={col.num}>{r.score ?? "-"}</Text>
          <Text style={col.num}>{r.letter ?? "-"}</Text>
          <Text style={col.num}>{r.gradePoints ?? "-"}</Text>
        </View>
      ))}
    </View>
  );
}

function Summary({ items }: { items: [string, string][] }) {
  return (
    <View style={docStyles.totals} wrap={false}>
      {items.map(([label, value]) => (
        <View key={label} style={docStyles.totalRow}>
          <Text>{label}</Text>
          <Text style={docStyles.bold}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Semester grade report (SPEC.md 7.3 outputs). */
export function GradeReportDocument({ data }: { data: GradeReportPdfData }) {
  return (
    <Document title={`Grade report ${data.documentNumber}`} author={data.org.orgName}>
      <Page size="A4" style={docStyles.page}>
        <Letterhead data={data.org} />
        <Text style={docStyles.title}>Grade report</Text>
        <Text style={docStyles.value}>{data.documentNumber}</Text>
        <StudentBlock student={data.student} extra={[["Term", data.term]]} />
        <ResultsTable rows={data.rows} />
        <Summary
          items={[
            ["Term GPA", data.termGpa],
            ["Cumulative GPA", data.cgpa],
            ["Credits earned to date", String(data.creditsEarned)],
          ]}
        />
        <DocumentFooter
          documentLabel={`Grade report ${data.documentNumber}`}
          generatedAt={data.generatedAt}
          timezone={data.timezone}
        />
      </Page>
    </Document>
  );
}

/** Transcript: every term with its GPA, then CGPA and credits earned (SPEC.md 7.3). */
export function TranscriptDocument({ data }: { data: TranscriptPdfData }) {
  return (
    <Document title={`Transcript ${data.documentNumber}`} author={data.org.orgName}>
      <Page size="A4" style={docStyles.page}>
        <Letterhead data={data.org} />
        <Text style={docStyles.title}>Academic transcript</Text>
        <Text style={docStyles.value}>{data.documentNumber}</Text>
        <StudentBlock student={data.student} extra={[]} />
        {data.terms.map((term) => (
          <View key={term.name} style={{ marginTop: 10 }}>
            <Text style={[docStyles.bold, { marginTop: 8, color: pdfColors.primaryDark }]}>
              {term.name}
            </Text>
            <ResultsTable rows={term.rows} />
            <Text style={{ marginTop: 6, textAlign: "right" }}>
              Term GPA {term.gpa} · Credits earned {term.creditsEarned}
            </Text>
          </View>
        ))}
        {data.terms.length === 0 ? (
          <Text style={{ marginTop: 16, color: pdfColors.muted }}>No published grades yet.</Text>
        ) : null}
        <Summary
          items={[
            ["Cumulative GPA", data.cgpa],
            ["Credits earned", `${data.creditsEarned} of ${data.creditsRequired}`],
          ]}
        />
        <DocumentFooter
          documentLabel={`Transcript ${data.documentNumber}`}
          generatedAt={data.generatedAt}
          timezone={data.timezone}
        />
      </Page>
    </Document>
  );
}
