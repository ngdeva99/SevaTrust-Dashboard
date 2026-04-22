/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "bold",
  },
  subheader: {
    textAlign: "center",
    fontSize: 8,
    color: "#666",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "33.33%",
    padding: 6,
    borderRight: 0.5,
    borderBottom: 0.5,
    borderColor: "#999",
    minHeight: 70,
  },
  name: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  line: {
    fontSize: 8.5,
  },
  code: {
    fontSize: 7,
    color: "#888",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    fontSize: 7,
    color: "#999",
    textAlign: "center",
  },
});

export type MailingMember = {
  member_code: string;
  title?: string | null;
  full_name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  country?: string | null;
  diary_copies?: number | null;
};

export function MailingListPdf({
  members,
  title = "Mailing List",
  subtitle,
}: {
  members: MailingMember[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{title}</Text>
        {subtitle && <Text style={styles.subheader}>{subtitle}</Text>}
        <View style={styles.grid}>
          {members.map((m) => {
            const addrLines = [m.address_line1, m.address_line2, m.address_line3].filter(Boolean);
            const lastLine = [m.city, m.state, m.pin_code].filter(Boolean).join(" ");
            return (
              <View key={m.member_code} style={styles.cell} wrap={false}>
                <Text style={styles.name}>
                  {(m.title ?? "") + " " + m.full_name}
                </Text>
                {addrLines.map((l, i) => (
                  <Text key={i} style={styles.line}>
                    {l}
                  </Text>
                ))}
                {lastLine && <Text style={styles.line}>{lastLine}</Text>}
                {m.country && m.country !== "India" && (
                  <Text style={styles.line}>{m.country}</Text>
                )}
                <Text style={styles.code}>
                  {m.member_code}
                  {(m.diary_copies ?? 1) > 1 ? `  ·  ${m.diary_copies} copies` : ""}
                </Text>
              </View>
            );
          })}
        </View>
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated ${new Date().toLocaleDateString("en-IN")}  —  Page ${pageNumber} / ${totalPages}  —  ${members.length} members`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
