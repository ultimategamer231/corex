import { formatMoney, type Money } from "@corex/core/money";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { DocumentFooter } from "./document-footer";
import { docStyles } from "./invoice";
import { Letterhead, type LetterheadData } from "./letterhead";
import { pdfColors } from "./theme";

const moneyCol = { flex: 2, textAlign: "right" as const };

export type PayslipPdfData = {
  org: LetterheadData;
  timezone: string;
  /** "October 2026" */
  period: string;
  employee: {
    name: string;
    number: string;
    position?: string | null;
    paymentMethod: string;
    reference?: string | null;
  };
  /** Snapshot lines in order: base salary, allowances, deductions (FIN-06). */
  lines: { name: string; kind: "base" | "allowance" | "deduction"; amount: Money }[];
  gross: Money;
  deductions: Money;
  net: Money;
  status: "approved" | "paid";
  generatedAt: Date;
};

/** One employee's payslip for a month, from the lines saved at approval. */
export function PayslipDocument({ data }: { data: PayslipPdfData }) {
  const earnings = data.lines.filter((l) => l.kind !== "deduction");
  const deductions = data.lines.filter((l) => l.kind === "deduction");
  const section = (title: string, lines: PayslipPdfData["lines"], total: Money) => (
    <View style={{ marginTop: 14 }}>
      <View style={docStyles.tableHead}>
        <Text style={{ flex: 3 }}>{title}</Text>
        <Text style={moneyCol}>Amount</Text>
      </View>
      {lines.map((l) => (
        <View key={`${l.kind}-${l.name}`} style={docStyles.tableRow}>
          <Text style={{ flex: 3 }}>{l.name}</Text>
          <Text style={moneyCol}>{formatMoney(l.amount)}</Text>
        </View>
      ))}
      <View style={docStyles.tableRow}>
        <Text style={[{ flex: 3 }, docStyles.bold]}>Total {title.toLowerCase()}</Text>
        <Text style={[moneyCol, docStyles.bold]}>{formatMoney(total)}</Text>
      </View>
    </View>
  );
  return (
    <Document title={`Payslip ${data.employee.number} ${data.period}`} author={data.org.orgName}>
      <Page size="A4" style={docStyles.page}>
        <Letterhead data={data.org} />
        <View style={docStyles.row}>
          <View>
            <Text style={docStyles.title}>Payslip</Text>
            <Text>{data.period}</Text>
          </View>
          <View>
            <Text style={docStyles.label}>Employee</Text>
            <Text style={docStyles.bold}>{data.employee.name}</Text>
            <Text>{data.employee.number}</Text>
            {data.employee.position ? <Text>{data.employee.position}</Text> : null}
          </View>
        </View>
        {section("Earnings", earnings, data.gross)}
        {section("Deductions", deductions, data.deductions)}
        <View
          style={[
            docStyles.row,
            { marginTop: 16, borderTopWidth: 1, borderColor: pdfColors.border, paddingTop: 8 },
          ]}
        >
          <Text style={[docStyles.bold, { fontSize: 12 }]}>Net pay</Text>
          <Text style={[docStyles.bold, { fontSize: 14, color: pdfColors.primaryDark }]}>
            {formatMoney(data.net)}
          </Text>
        </View>
        <Text style={{ marginTop: 6, color: pdfColors.muted }}>
          Paid by {data.employee.paymentMethod}
          {data.employee.reference ? ` to ${data.employee.reference}` : ""}.{" "}
          {data.status === "paid" ? "Paid." : "Approved, not yet paid."}
        </Text>
        <DocumentFooter
          documentLabel={`Payslip ${data.employee.number} ${data.period}`}
          generatedAt={data.generatedAt}
          timezone={data.timezone}
        />
      </Page>
    </Document>
  );
}

export type ReportPdfData = {
  org: LetterheadData;
  timezone: string;
  title: string;
  subtitle: string;
  columns: { label: string; numeric?: boolean }[];
  /** Cells already formatted for display, so the PDF shows what the screen shows (FIN-08). */
  rows: string[][];
  total?: string[];
  generatedAt: Date;
};

/** A report table with letterhead, title, period and generation time. */
export function ReportDocument({ data }: { data: ReportPdfData }) {
  const flex = (i: number) => (data.columns.length > 3 && i === 1 ? 3 : 1.4);
  const cells = (row: string[], bold = false) =>
    row.map((cell, i) => (
      <Text
        key={i}
        style={[
          { flex: flex(i), textAlign: data.columns[i]?.numeric ? "right" : "left" },
          bold ? docStyles.bold : {},
        ]}
      >
        {cell}
      </Text>
    ));
  return (
    <Document title={data.title} author={data.org.orgName}>
      <Page
        size="A4"
        orientation={data.columns.length > 4 ? "landscape" : "portrait"}
        style={docStyles.page}
      >
        <Letterhead data={data.org} />
        <Text style={docStyles.title}>{data.title}</Text>
        <Text style={{ color: pdfColors.muted, marginBottom: 10 }}>{data.subtitle}</Text>
        <View style={docStyles.tableHead} fixed>
          {cells(data.columns.map((c) => c.label))}
        </View>
        {data.rows.map((row, i) => (
          <View key={i} style={docStyles.tableRow} wrap={false}>
            {cells(row)}
          </View>
        ))}
        {data.total ? (
          <View style={[docStyles.tableRow, { borderTopWidth: 1, borderColor: pdfColors.ink }]}>
            {cells(data.total, true)}
          </View>
        ) : null}
        <DocumentFooter
          documentLabel={data.title}
          generatedAt={data.generatedAt}
          timezone={data.timezone}
        />
      </Page>
    </Document>
  );
}
