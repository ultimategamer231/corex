import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COREX_LOGO_PNG } from "./logo";
import { pdfColors, pdfFonts } from "./theme";

/**
 * Corex's own invoice, receipt and quote (SPEC-ADMIN.md 9.4; owner-approved design,
 * 18 Nov 2026). Every value arrives formatted, from the same data the admin's on-screen
 * preview shows, so the PDF and the preview match.
 */
export type BillingDocData = {
  kind: "invoice" | "receipt" | "quote";
  company: { name: string; lines: string[] };
  /** null on a draft: "Number assigned on sending". */
  number: string | null;
  watermark: "DRAFT" | "VOID" | null;
  /** Dates under the number, for example Issued and Due. */
  meta: { label: string; value: string }[];
  /** Invoice: a tag under the dates. Receipt: the status beside the amount received. */
  status: { label: string; tone: "paid" | "part" | "due" } | null;
  billTo: { name: string; lines: string[] };
  /** Receipt: Invoice reference, Payment method, Received on. */
  facts: { label: string; value: string }[];
  /** Receipt: the amount received, with a line under the status. */
  highlight: { value: string; note: string | null } | null;
  lines: {
    title: string;
    details: string | null;
    quantity: string;
    unit: string;
    amount: string;
  }[];
  totals: { label: string; value: string; strong?: boolean }[];
  /** The last, large line of the totals: BALANCE DUE, OUTSTANDING BALANCE or TOTAL. */
  grand: { label: string; value: string; tone: "primary" | "paid" };
  note: string | null;
  /** Invoice: the payments received, one line each. */
  payments: { label: string; amount: string }[];
  questions: string[];
  paymentInfo: string | null;
  terms: string | null;
  generatedAt: string;
};

const ORANGE = "#FF5A12";

let logo: Buffer | null = null;
/** The logo as bytes: react-pdf on the server reads a data URI as a file path. */
function logoBytes(): Buffer {
  logo ??= Buffer.from(COREX_LOGO_PNG.slice(COREX_LOGO_PNG.indexOf(",") + 1), "base64");
  return logo;
}
const SURFACE = "#F4F8F7";
const RULE = "#E3ECEB";
const WARN = "#8A2E00";

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 42,
    paddingBottom: 60,
    fontFamily: pdfFonts.body,
    fontSize: 9.5,
    color: pdfColors.ink,
  },
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, flexDirection: "row" },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  logo: { width: 150, height: 53 },
  docSide: { alignItems: "flex-end", maxWidth: 260 },
  kindBig: { fontFamily: pdfFonts.bold, fontSize: 22, letterSpacing: 0.5 },
  kindSmall: {
    fontFamily: pdfFonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: pdfColors.primary,
  },
  numTeal: { fontFamily: pdfFonts.bold, fontSize: 11.5, color: pdfColors.primary, marginTop: 3 },
  numBig: { fontFamily: pdfFonts.bold, fontSize: 17, marginTop: 3 },
  dates: { fontSize: 8.5, color: pdfColors.muted, marginTop: 4, textAlign: "right" },
  tag: {
    marginTop: 6,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: 9,
    fontFamily: pdfFonts.bold,
    fontSize: 7.5,
    letterSpacing: 0.6,
  },
  label: {
    fontFamily: pdfFonts.bold,
    fontSize: 7.5,
    letterSpacing: 0.7,
    color: pdfColors.primary,
    marginBottom: 6,
  },
  parties: {
    flexDirection: "row",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  party: { flex: 1, paddingRight: 16 },
  partyName: { fontFamily: pdfFonts.bold, fontSize: 12, marginBottom: 3 },
  muted: { fontSize: 9, color: pdfColors.muted, lineHeight: 1.5 },
  fact: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  factValue: { fontFamily: pdfFonts.bold },
  amountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderLeftWidth: 4,
    borderLeftColor: pdfColors.primary,
    borderRadius: 6,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  amountValue: { fontFamily: pdfFonts.bold, fontSize: 26, marginTop: 2 },
  statusText: { fontFamily: pdfFonts.bold, fontSize: 12, marginTop: 2, textAlign: "right" },
  sectionTitle: { marginTop: 18 },
  th: {
    flexDirection: "row",
    backgroundColor: pdfColors.primary,
    color: "#FFFFFF",
    paddingVertical: 7,
    paddingHorizontal: 9,
    fontFamily: pdfFonts.bold,
    fontSize: 7.5,
    letterSpacing: 0.6,
  },
  line: {
    flexDirection: "row",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  lineTitle: { fontFamily: pdfFonts.bold, fontSize: 9.5 },
  lineNo: { fontFamily: pdfFonts.bold, color: pdfColors.primary },
  details: { fontSize: 8, color: pdfColors.muted, marginTop: 3, lineHeight: 1.45 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  notes: { flex: 1, paddingRight: 22 },
  noteText: { fontSize: 8.5, color: pdfColors.muted, lineHeight: 1.5 },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    fontSize: 8.5,
  },
  totalsBox: {
    width: 220,
    alignSelf: "flex-start",
    backgroundColor: SURFACE,
    borderRadius: 6,
    padding: 11,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    color: pdfColors.muted,
  },
  totalStrong: { fontFamily: pdfFonts.bold, color: pdfColors.ink },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    marginTop: 5,
    paddingTop: 8,
  },
  grandLabel: { fontFamily: pdfFonts.bold, fontSize: 8.5, color: pdfColors.primary },
  grandValue: { fontFamily: pdfFonts.bold, fontSize: 15, color: pdfColors.primary },
  infoRow: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: RULE,
  },
  infoCol: { flex: 1, paddingRight: 16 },
  infoText: { fontSize: 9, lineHeight: 1.45 },
  thanks: { fontFamily: pdfFonts.bold, fontSize: 10, marginTop: 14 },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: RULE,
    fontSize: 7.5,
    color: pdfColors.muted,
  },
  footerBrand: { fontFamily: pdfFonts.bold, color: pdfColors.primary, letterSpacing: 0.5 },
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
  desc: { flex: 6, paddingRight: 10 },
  qty: { width: 34, textAlign: "right" as const },
  money: { width: 74, textAlign: "right" as const },
};

const TONES = {
  paid: { color: pdfColors.primary, background: pdfColors.tint },
  part: { color: WARN, background: "#FDF1E7" },
  due: { color: pdfColors.muted, background: SURFACE },
} as const;

const TITLES = { invoice: "INVOICE", receipt: "PAYMENT RECEIPT", quote: "QUOTE" } as const;
const PARTY_LABELS = { invoice: "BILL TO", receipt: "ISSUED TO", quote: "PREPARED FOR" } as const;

function Label({ children }: { children: string }) {
  return <Text style={s.label}>{children}</Text>;
}

function Lines({ data }: { data: BillingDocData }) {
  const receipt = data.kind === "receipt";
  return (
    <>
      <View style={s.th}>
        <Text style={col.desc}>DESCRIPTION</Text>
        <Text style={col.qty}>QTY</Text>
        <Text style={col.money}>{receipt ? "UNIT PRICE" : "RATE"}</Text>
        <Text style={col.money}>AMOUNT</Text>
      </View>
      {data.lines.map((l, i) => (
        <View key={i} style={s.line} wrap={false}>
          <View style={col.desc}>
            <Text style={s.lineTitle}>
              {receipt ? null : <Text style={s.lineNo}>{String(i + 1).padStart(2, "0")} </Text>}
              {l.title}
            </Text>
            {l.details ? <Text style={s.details}>{l.details}</Text> : null}
          </View>
          <Text style={col.qty}>{l.quantity}</Text>
          <Text style={col.money}>{l.unit}</Text>
          <Text style={[col.money, s.factValue]}>{l.amount}</Text>
        </View>
      ))}
    </>
  );
}

function Totals({ data }: { data: BillingDocData }) {
  return (
    <View style={s.totalsBox}>
      {data.totals.map((t) => (
        <View key={t.label} style={[s.totalRow, t.strong ? s.totalStrong : {}]}>
          <Text>{t.label}</Text>
          <Text>{t.value}</Text>
        </View>
      ))}
      <View style={s.grand}>
        <Text style={s.grandLabel}>{data.grand.label}</Text>
        <Text style={s.grandValue}>{data.grand.value}</Text>
      </View>
    </View>
  );
}

export function BillingDocument({ data }: { data: BillingDocData }) {
  const title = TITLES[data.kind];
  const numberText = data.number ?? "Number assigned on sending";
  const receipt = data.kind === "receipt";
  const tone = data.status ? TONES[data.status.tone] : null;
  return (
    <Document title={`${title} ${data.number ?? "draft"}`} author={data.company.name}>
      <Page size="A4" style={s.page}>
        <View style={s.bar} fixed>
          <View style={{ flex: 4, backgroundColor: pdfColors.primary }} />
          <View style={{ flex: 1, backgroundColor: ORANGE }} />
        </View>
        {data.watermark ? (
          <Text style={s.watermark} fixed>
            {data.watermark}
          </Text>
        ) : null}

        <View style={s.head}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt text */}
          <Image style={s.logo} src={{ data: logoBytes(), format: "png" }} />
          <View style={s.docSide}>
            <Text style={receipt ? s.kindSmall : s.kindBig}>{title}</Text>
            <Text style={receipt ? s.numBig : s.numTeal}>{numberText}</Text>
            <Text style={s.dates}>
              {data.meta.map((m) => `${m.label} ${m.value}`).join("  |  ")}
            </Text>
            {!receipt && data.status && tone ? (
              <Text style={[s.tag, { color: tone.color, backgroundColor: tone.background }]}>
                {data.status.label}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={s.parties}>
          {receipt ? null : (
            <View style={s.party}>
              <Label>FROM</Label>
              <Text style={s.partyName}>{data.company.name}</Text>
              {data.company.lines.map((l) => (
                <Text key={l} style={s.muted}>
                  {l}
                </Text>
              ))}
            </View>
          )}
          <View style={s.party}>
            <Label>{PARTY_LABELS[data.kind]}</Label>
            <Text style={s.partyName}>{data.billTo.name}</Text>
            {data.billTo.lines.map((l) => (
              <Text key={l} style={s.muted}>
                {l}
              </Text>
            ))}
          </View>
          {receipt ? (
            <View style={[s.party, { paddingRight: 0 }]}>
              <Label>PAYMENT DETAILS</Label>
              {data.facts.map((f) => (
                <View key={f.label} style={s.fact}>
                  <Text style={{ color: pdfColors.muted }}>{f.label}</Text>
                  <Text style={s.factValue}>{f.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {receipt && data.highlight ? (
          <View style={s.amountBox} wrap={false}>
            <View>
              <Label>AMOUNT RECEIVED</Label>
              <Text style={s.amountValue}>{data.highlight.value}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Label>PAYMENT STATUS</Label>
              {data.status && tone ? (
                <Text style={[s.statusText, { color: tone.color }]}>{data.status.label}</Text>
              ) : null}
              {data.highlight.note ? (
                <Text style={[s.muted, { textAlign: "right" }]}>{data.highlight.note}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={receipt ? s.sectionTitle : { marginTop: 16 }}>
          {receipt ? <Label>TRANSACTION SUMMARY</Label> : null}
          <Lines data={data} />
        </View>

        <View style={s.bottom} wrap={false}>
          <View style={s.notes}>
            {data.note ? (
              <>
                <Label>{data.kind === "quote" ? "NOTES AND TERMS" : "NOTES"}</Label>
                <Text style={s.noteText}>{data.note}</Text>
              </>
            ) : null}
            {data.payments.length > 0 ? (
              <View style={{ marginTop: data.note ? 12 : 0 }}>
                <Label>PAYMENTS RECEIVED</Label>
                {data.payments.map((p) => (
                  <View key={p.label} style={s.payRow}>
                    <Text>{p.label}</Text>
                    <Text>{p.amount}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <Totals data={data} />
        </View>

        {receipt ? (
          <View style={s.infoRow} wrap={false}>
            <View style={s.infoCol}>
              <Text style={[s.thanks, { marginTop: 0 }]}>Thank you for your business.</Text>
              <Text style={[s.muted, { marginBottom: 10 }]}>
                This receipt confirms payment received for the invoice above.
              </Text>
              <Label>{data.company.name.toUpperCase()}</Label>
              {data.company.lines.map((l) => (
                <Text key={l} style={s.muted}>
                  {l}
                </Text>
              ))}
              <Text style={s.muted}>{data.questions.join("  |  ")}</Text>
            </View>
          </View>
        ) : (
          <View wrap={false}>
            <View style={s.infoRow}>
              <View style={s.infoCol}>
                <Label>PAYMENT METHODS</Label>
                <Text style={s.infoText}>{data.paymentInfo ?? ""}</Text>
              </View>
              <View style={s.infoCol}>
                <Label>PAYMENT TERMS</Label>
                <Text style={s.infoText}>{data.terms ?? ""}</Text>
              </View>
              <View style={[s.infoCol, { paddingRight: 0 }]}>
                <Label>QUESTIONS?</Label>
                {data.questions.map((q) => (
                  <Text key={q} style={s.infoText}>
                    {q}
                  </Text>
                ))}
              </View>
            </View>
            <Text style={s.thanks}>Thank you for your business.</Text>
          </View>
        )}

        <View style={s.pageFooter} fixed>
          <Text style={s.footerBrand}>{data.company.name.toUpperCase()}</Text>
          <Text>Generated {data.generatedAt}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${data.kind === "receipt" ? "RECEIPT" : title} ${numberText} · Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
