import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfColors, pdfFonts } from "./theme";

/**
 * Corex's own invoice, receipt and quote (SPEC-ADMIN.md 9.4, InvoiceDoc.dc.html). Every
 * value arrives formatted, from the same data the admin's on-screen preview shows, so the
 * PDF and the preview match.
 */
export type BillingDocData = {
  kind: "invoice" | "receipt" | "quote";
  company: { name: string; lines: string[] };
  /** null on a draft: "Number assigned on sending". */
  number: string | null;
  watermark: "DRAFT" | "VOID" | null;
  meta: { label: string; value: string }[];
  billTo: { name: string; lines: string[] };
  lines: {
    title: string;
    details: string | null;
    quantity: string;
    unit: string;
    amount: string;
  }[];
  totals: { label: string; value: string }[];
  /** The solid block: TOTAL DUE, AMOUNT PAID or TOTAL. */
  grand: { label: string; value: string; tone: "primary" | "paid" };
  note: string | null;
  questions: string[];
  paymentInfo: string | null;
  terms: string | null;
  generatedAt: string;
};

const s = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 72,
    fontFamily: pdfFonts.body,
    fontSize: 10,
    color: pdfColors.ink,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  company: { fontFamily: pdfFonts.bold, fontSize: 15, color: pdfColors.primaryDark },
  small: { fontSize: 9, color: pdfColors.muted },
  title: { fontFamily: pdfFonts.bold, fontSize: 26, letterSpacing: 1, textAlign: "right" },
  number: { fontFamily: pdfFonts.bold, fontSize: 11, textAlign: "right", marginTop: 2 },
  metaLine: { fontSize: 9, color: pdfColors.muted, textAlign: "right", marginTop: 2 },
  to: { marginTop: 22 },
  toLabel: { fontSize: 9, color: pdfColors.muted, marginBottom: 2 },
  bold: { fontFamily: pdfFonts.bold },
  head: {
    flexDirection: "row",
    backgroundColor: pdfColors.primary,
    color: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 20,
    fontFamily: pdfFonts.bold,
    fontSize: 9,
  },
  line: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  details: { fontSize: 8.5, color: pdfColors.muted, marginTop: 2 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  note: { width: 230, fontSize: 9, color: pdfColors.muted },
  thanks: { fontFamily: pdfFonts.bold, color: pdfColors.ink, marginTop: 8 },
  totals: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginTop: 4,
    color: "#FFFFFF",
    fontFamily: pdfFonts.bold,
    fontSize: 11,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    fontSize: 8.5,
    color: pdfColors.muted,
  },
  footerCol: { width: "31%" },
  footerHead: { fontFamily: pdfFonts.bold, color: pdfColors.ink, marginBottom: 3 },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: pdfColors.muted,
  },
  watermark: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: pdfFonts.bold,
    fontSize: 96,
    color: pdfColors.border,
    transform: "rotate(-14deg)",
  },
});

const col = {
  desc: { flex: 5 },
  qty: { flex: 1, textAlign: "right" as const },
  money: { flex: 2, textAlign: "right" as const },
};

const TITLES = { invoice: "INVOICE", receipt: "RECEIPT", quote: "QUOTE" } as const;

export function BillingDocument({ data }: { data: BillingDocData }) {
  const title = TITLES[data.kind];
  const numberText = data.number ?? "Number assigned on sending";
  return (
    <Document title={`${title} ${data.number ?? "draft"}`} author={data.company.name}>
      <Page size="A4" style={s.page}>
        {data.watermark ? (
          <Text style={s.watermark} fixed>
            {data.watermark}
          </Text>
        ) : null}
        <View style={s.row}>
          <View style={{ width: 260 }}>
            <Text style={s.company}>{data.company.name}</Text>
            {data.company.lines.map((l) => (
              <Text key={l} style={s.small}>
                {l}
              </Text>
            ))}
          </View>
          <View>
            <Text style={s.title}>{title}</Text>
            <Text style={s.number}>{numberText}</Text>
            {data.meta.map((m) => (
              <Text key={m.label} style={s.metaLine}>
                {m.label}: {m.value}
              </Text>
            ))}
          </View>
        </View>

        <View style={s.to}>
          <Text style={s.toLabel}>To:</Text>
          <Text style={s.bold}>{data.billTo.name}</Text>
          {data.billTo.lines.map((l) => (
            <Text key={l} style={s.small}>
              {l}
            </Text>
          ))}
        </View>

        <View style={s.head}>
          <Text style={col.desc}>Description</Text>
          <Text style={col.qty}>Qty</Text>
          <Text style={col.money}>Price</Text>
          <Text style={col.money}>Amount</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={s.line} wrap={false}>
            <View style={col.desc}>
              <Text style={s.bold}>{l.title}</Text>
              {l.details ? <Text style={s.details}>{l.details}</Text> : null}
            </View>
            <Text style={col.qty}>{l.quantity}</Text>
            <Text style={col.money}>{l.unit}</Text>
            <Text style={col.money}>{l.amount}</Text>
          </View>
        ))}

        <View style={s.bottom} wrap={false}>
          <View style={s.note}>
            {data.note ? <Text>{data.note}</Text> : null}
            <Text style={s.thanks}>Thank you for your business.</Text>
          </View>
          <View style={s.totals}>
            {data.totals.map((t) => (
              <View key={t.label} style={s.totalRow}>
                <Text>{t.label}</Text>
                <Text>{t.value}</Text>
              </View>
            ))}
            <View
              style={[
                s.grand,
                {
                  backgroundColor:
                    data.grand.tone === "paid" ? pdfColors.primary : pdfColors.primaryDark,
                },
              ]}
            >
              <Text>{data.grand.label}</Text>
              <Text>{data.grand.value}</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} wrap={false}>
          <View style={s.footerCol}>
            <Text style={s.footerHead}>Questions</Text>
            {data.questions.map((q) => (
              <Text key={q}>{q}</Text>
            ))}
          </View>
          <View style={s.footerCol}>
            <Text style={s.footerHead}>Payment info</Text>
            <Text>{data.paymentInfo ?? ""}</Text>
          </View>
          <View style={s.footerCol}>
            <Text style={s.footerHead}>Terms and notes</Text>
            <Text>{data.terms ?? ""}</Text>
          </View>
        </View>

        <View style={s.pageFooter} fixed>
          <Text>
            {title} {numberText}
          </Text>
          <Text>Generated {data.generatedAt}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
