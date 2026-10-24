import { formatDateTime } from "@corex/core/dates";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfColors } from "./theme";

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
    fontSize: 8,
    color: pdfColors.muted,
  },
});

/** Document number and generation time on every page (CORE-10). */
export function DocumentFooter({
  documentLabel,
  generatedAt,
  timezone,
}: {
  documentLabel: string;
  generatedAt: Date;
  timezone: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text>{documentLabel}</Text>
      <Text>Generated {formatDateTime(generatedAt, timezone)}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
