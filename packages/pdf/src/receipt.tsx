import { formatDateTime } from "@corex/core/dates";
import { formatMoney, type Money } from "@corex/core/money";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { DocumentFooter } from "./document-footer";
import { documentNumber } from "./format";
import { docStyles } from "./invoice";
import { Letterhead, type LetterheadData } from "./letterhead";
import { pdfColors } from "./theme";

const METHOD_LABEL = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank transfer",
  other: "Other",
} as const;

export type ReceiptPdfData = {
  org: LetterheadData;
  timezone: string;
  number: number;
  invoiceNumber: number;
  receivedFrom: string;
  amount: Money;
  method: keyof typeof METHOD_LABEL;
  reference?: string | null;
  receivedAt: string;
  receivedBy?: string | null;
  balanceAfter: Money;
  /** A voided payment's receipt stays printable, marked void with the reason (CORE-07). */
  voidReason?: string | null;
  generatedAt: Date;
};

export function ReceiptDocument({ data }: { data: ReceiptPdfData }) {
  const label = documentNumber("RCT", data.number);
  const rows: [string, string][] = [
    ["Received from", data.receivedFrom],
    ["For invoice", documentNumber("INV", data.invoiceNumber)],
    ["Payment method", METHOD_LABEL[data.method]],
    ...(data.reference ? ([["Reference", data.reference]] as [string, string][]) : []),
    ["Date received", formatDateTime(data.receivedAt, data.timezone)],
    ...(data.receivedBy ? ([["Received by", data.receivedBy]] as [string, string][]) : []),
    ["Balance after this payment", formatMoney(data.balanceAfter)],
  ];
  return (
    <Document title={`Receipt ${label}`} author={data.org.orgName}>
      <Page size="A5" style={docStyles.page}>
        <Letterhead data={data.org} />
        <View style={docStyles.row}>
          <View>
            <Text style={docStyles.title}>Receipt</Text>
            <Text>{label}</Text>
          </View>
          <View>
            <Text style={docStyles.label}>Amount received</Text>
            <Text style={[docStyles.bold, { fontSize: 16, color: pdfColors.primaryDark }]}>
              {formatMoney(data.amount)}
            </Text>
          </View>
        </View>
        {data.voidReason ? <Text style={docStyles.voidBanner}>VOID: {data.voidReason}</Text> : null}
        <View style={{ marginTop: 16 }}>
          {rows.map(([name, value]) => (
            <View key={name} style={[docStyles.tableRow, { paddingHorizontal: 0 }]}>
              <Text style={{ flex: 1, color: pdfColors.muted }}>{name}</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>{value}</Text>
            </View>
          ))}
        </View>
        <DocumentFooter
          documentLabel={`Receipt ${label}`}
          generatedAt={data.generatedAt}
          timezone={data.timezone}
        />
      </Page>
    </Document>
  );
}
