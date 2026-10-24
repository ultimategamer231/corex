import { Document, Page, Text, View } from "@react-pdf/renderer";
import { DocumentFooter } from "./document-footer";
import { docStyles } from "./invoice";
import { Letterhead, type LetterheadData } from "./letterhead";
import { pdfColors } from "./theme";

export type ReportCardPdfData = {
  org: LetterheadData;
  timezone: string;
  /** Document reference, for example "RC-SC-2026-0001-S1". */
  documentNumber: string;
  student: { name: string; studentNumber: string; gradeSection: string; year: string };
  /** "Semester 1" or "Semester 1, Period 2". */
  period: string;
  /** Column headings, for example Period 1 ... Semester exam. */
  columns: string[];
  rows: { subject: string; scores: (string | null)[]; average: string; passed: boolean | null }[];
  overallAverage: string;
  passMark: number;
  /** Shown only when the school turns ranking on. */
  rank?: string | null;
  attendance: { present: number; absent: number; late: number; excused: number };
  generatedAt: Date;
};

/** Report card per marking period or semester (SPEC.md 7.4, SCH-08). */
export function ReportCardDocument({ data }: { data: ReportCardPdfData }) {
  const width = `${Math.max(8, Math.floor(56 / (data.columns.length + 1)))}%`;
  const cell = { width, textAlign: "right" as const };
  const info: [string, string][] = [
    ["Student", data.student.name],
    ["Student number", data.student.studentNumber],
    ["Class", data.student.gradeSection],
    ["Academic year", data.student.year],
  ];
  return (
    <Document title={`Report card ${data.documentNumber}`} author={data.org.orgName}>
      <Page size="A4" style={docStyles.page}>
        <Letterhead data={data.org} />
        <Text style={docStyles.title}>Report card</Text>
        <Text style={docStyles.value}>
          {data.period} · {data.documentNumber}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
          {info.map(([label, value]) => (
            <View key={label} style={{ width: "50%", marginBottom: 8 }}>
              <Text style={docStyles.label}>{label}</Text>
              <Text style={docStyles.value}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={docStyles.tableHead} wrap={false}>
          <Text style={{ width: "44%" }}>Subject</Text>
          {data.columns.map((c) => (
            <Text key={c} style={cell}>
              {c}
            </Text>
          ))}
          <Text style={cell}>Average</Text>
        </View>
        {data.rows.map((r) => (
          <View key={r.subject} style={docStyles.tableRow} wrap={false}>
            <Text style={{ width: "44%" }}>{r.subject}</Text>
            {r.scores.map((s, i) => (
              <Text key={data.columns[i] ?? i} style={cell}>
                {s ?? "-"}
              </Text>
            ))}
            <Text
              style={[cell, docStyles.bold, r.passed === false ? { color: pdfColors.danger } : {}]}
            >
              {r.average}
              {r.passed === false ? " *" : ""}
            </Text>
          </View>
        ))}
        <View style={docStyles.totals} wrap={false}>
          <View style={docStyles.totalRow}>
            <Text>Overall average</Text>
            <Text style={docStyles.bold}>{data.overallAverage}</Text>
          </View>
          {data.rank ? (
            <View style={docStyles.totalRow}>
              <Text>Rank in class</Text>
              <Text style={docStyles.bold}>{data.rank}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ marginTop: 6, fontSize: 8, color: pdfColors.muted }}>
          * Below the pass mark of {data.passMark}.
        </Text>
        <View style={{ marginTop: 14 }} wrap={false}>
          <Text style={docStyles.label}>Attendance</Text>
          <Text>
            Present {data.attendance.present} · Absent {data.attendance.absent} · Late{" "}
            {data.attendance.late} · Excused {data.attendance.excused}
          </Text>
        </View>
        <View
          style={{
            marginTop: 14,
            borderWidth: 1,
            borderColor: pdfColors.border,
            padding: 8,
            minHeight: 70,
          }}
          wrap={false}
        >
          <Text style={docStyles.label}>Teacher&apos;s remarks</Text>
        </View>
        <DocumentFooter
          documentLabel={`Report card ${data.documentNumber}`}
          generatedAt={data.generatedAt}
          timezone={data.timezone}
        />
      </Page>
    </Document>
  );
}
