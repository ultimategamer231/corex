import { formatMoney, type Money } from "@corex/core/money";
import { formatDate } from "@corex/core/dates";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { DocumentFooter } from "./document-footer";
import { documentNumber } from "./format";
import { Letterhead, type LetterheadData } from "./letterhead";
import { pdfColors, pdfFonts } from "./theme";

export type InvoicePdfData = {
  org: LetterheadData;
  timezone: string;
  number: number;
  status: "issued" | "partially_paid" | "paid" | "void";
  issueDate: string;
  dueDate?: string | null;
  billTo: { name: string; detail?: string | null };
  lines: { description: string; quantity: string; unit: Money; amount: Money }[];
  total: Money;
  paid: Money;
  balance: Money;
  notes?: string | null;
  generatedAt: Date;
};

export const docStyles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 64,
    fontFamily: pdfFonts.body,
    fontSize: 10,
    color: pdfColors.ink,
  },
  title: { fontFamily: pdfFonts.bold, fontSize: 20, color: pdfColors.ink },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8, color: pdfColors.muted, textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 10 },
  bold: { fontFamily: pdfFonts.bold },
  tableHead: {
    flexDirection: "row",
    backgroundColor: pdfColors.tint,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 18,
    fontFamily: pdfFonts.bold,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  totals: { marginTop: 12, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  voidBanner: { color: pdfColors.danger, fontFamily: pdfFonts.bold, fontSize: 12, marginTop: 8 },
});

const col = {
  desc: { flex: 4 },
  qty: { flex: 1, textAlign: "right" as const },
  money: { flex: 2, textAlign: "right" as const },
};

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const label = documentNumber("INV", data.number);
  return (
    <Document title={`Invoice ${label}`} author={data.org.orgName}>
      <Page size="A4" style={docStyles.page}>
        <Letterhead data={data.org} />
        <View style={docStyles.row}>
          <View>
            <Text style={docStyles.title}>Invoice</Text>
            <Text style={docStyles.value}>{label}</Text>
            {data.status === "void" ? <Text style={docStyles.voidBanner}>VOID</Text> : null}
          </View>
          <View>
            <Text style={docStyles.label}>Issue date</Text>
            <Text style={docStyles.value}>{formatDate(data.issueDate, data.timezone)}</Text>
            {data.dueDate ? (
              <>
                <Text style={[docStyles.label, { marginTop: 6 }]}>Due date</Text>
                <Text style={docStyles.value}>{formatDate(data.dueDate, data.timezone)}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={docStyles.label}>Bill to</Text>
          <Text style={[docStyles.value, docStyles.bold]}>{data.billTo.name}</Text>
          {data.billTo.detail ? <Text style={docStyles.value}>{data.billTo.detail}</Text> : null}
        </View>

        <View style={docStyles.tableHead}>
          <Text style={col.desc}>Description</Text>
          <Text style={col.qty}>Qty</Text>
          <Text style={col.money}>Unit price ({data.total.currency})</Text>
          <Text style={col.money}>Amount ({data.total.currency})</Text>
        </View>
        {data.lines.map((line, i) => (
          <View key={i} style={docStyles.tableRow} wrap={false}>
            <Text style={col.desc}>{line.description}</Text>
            <Text style={col.qty}>{line.quantity}</Text>
            <Text style={col.money}>{formatMoney(line.unit)}</Text>
            <Text style={col.money}>{formatMoney(line.amount)}</Text>
          </View>
        ))}

        <View style={docStyles.totals}>
          <View style={docStyles.totalRow}>
            <Text>Total</Text>
            <Text style={docStyles.bold}>{formatMoney(data.total)}</Text>
          </View>
          <View style={docStyles.totalRow}>
            <Text>Paid</Text>
            <Text>{formatMoney(data.paid)}</Text>
          </View>
          <View style={[docStyles.totalRow, { borderTopWidth: 1, borderTopColor: pdfColors.ink }]}>
            <Text style={docStyles.bold}>Balance due</Text>
            <Text style={docStyles.bold}>{formatMoney(data.balance)}</Text>
          </View>
        </View>

        {data.notes ? (
          <View style={{ marginTop: 18 }}>
            <Text style={docStyles.label}>Notes</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        <DocumentFooter
          documentLabel={`Invoice ${label}`}
          generatedAt={data.generatedAt}
          timezone={data.timezone}
        />
      </Page>
    </Document>
  );
}
