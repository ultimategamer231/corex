import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfColors, pdfFonts } from "./theme";

/** Organization details printed on every document, from the `settings` row (CORE-01, CORE-10). */
export type LetterheadData = {
  orgName: string;
  /** Data URI, URL or file path of the organization's logo. */
  logoSrc?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  letterheadText?: string | null;
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: pdfColors.primary,
    marginBottom: 18,
  },
  logo: { width: 48, height: 48, objectFit: "contain" },
  name: { fontFamily: pdfFonts.bold, fontSize: 16, color: pdfColors.primaryDark },
  line: { fontSize: 9, color: pdfColors.muted, marginTop: 2 },
  tagline: { fontSize: 9, color: pdfColors.primary, marginTop: 3 },
});

export function Letterhead({ data }: { data: LetterheadData }) {
  const contact = [data.address, data.phone, data.email].filter(Boolean).join("  |  ");
  return (
    <View style={styles.header} fixed>
      {/* react-pdf Image, not an HTML img: PDFs have no alt attribute; the name follows as text. */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {data.logoSrc ? <Image style={styles.logo} src={data.logoSrc} /> : null}
      <View>
        <Text style={styles.name}>{data.orgName}</Text>
        {contact ? <Text style={styles.line}>{contact}</Text> : null}
        {data.letterheadText ? <Text style={styles.tagline}>{data.letterheadText}</Text> : null}
      </View>
    </View>
  );
}
