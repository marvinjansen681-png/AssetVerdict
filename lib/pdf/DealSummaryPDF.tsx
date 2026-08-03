import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
} from "@react-pdf/renderer";
import type { DealMetrics, YearlyProjection } from "@/lib/calculations";
import type { DealSummaryInputs } from "@/hooks/useDealMetrics";
import { getGaugeColor } from "@/lib/calculations/thresholds";

const COLORS = {
  navy: "#0F1F3D",
  gold: "#C9A84C",
  slate: "#4A5568",
  green: "#27AE60",
  orange: "#E67E22",
  red: "#E74C3C",
  lightGrey: "#EDF2F7",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: COLORS.navy },
  coverPage: {
    padding: 60,
    backgroundColor: COLORS.navy,
    color: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: { fontSize: 32, marginTop: 20, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  coverTagline: { fontSize: 12, color: COLORS.gold, marginBottom: 40 },
  coverDealName: { fontSize: 20, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  coverAddress: { fontSize: 11, color: "#CBD5E0", marginBottom: 30 },
  coverFooter: { position: "absolute", bottom: 60, fontSize: 9, color: "#CBD5E0" },
  h1: { fontSize: 18, marginBottom: 16, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 13, marginBottom: 10, marginTop: 18, fontFamily: "Helvetica-Bold" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricBox: {
    width: "23%",
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  metricColorBar: { height: 4, borderRadius: 2, marginBottom: 8 },
  metricLabel: { fontSize: 8, color: COLORS.slate, marginBottom: 4 },
  metricValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: COLORS.lightGrey, borderRadius: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.lightGrey },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    backgroundColor: COLORS.lightGrey,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableCell: { flex: 1, padding: 6, fontSize: 9 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label: { color: COLORS.slate },
  value: { fontFamily: "Helvetica-Bold" },
});

function fmt(n: number | null | undefined, currency = "R") {
  if (n === null || n === undefined) return "--";
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function colorFor(metricKey: string, value: number) {
  const c = getGaugeColor(metricKey, value);
  return COLORS[c];
}

function ShieldLogo() {
  return (
    <Svg width={40} height={40} viewBox="0 0 32 32">
      <Path
        d="M16 2 L28 7 V15 C28 22.5 22.8 27.8 16 30 C9.2 27.8 4 22.5 4 15 V7 L16 2 Z"
        stroke={COLORS.gold}
      />
      <Path
        d="M10.5 15.5 L14 19 L21.5 11"
        stroke={COLORS.gold}
      />
    </Svg>
  );
}

interface DealSummaryPDFProps {
  dealName: string;
  address?: string | null;
  currency: string;
  scenarioLabel: string;
  metrics: DealMetrics;
  projection: YearlyProjection[];
  dealSummary: DealSummaryInputs;
}

export default function DealSummaryPDF({
  dealName,
  address,
  currency,
  scenarioLabel,
  metrics,
  projection,
  dealSummary,
}: DealSummaryPDFProps) {
  const currencySymbol = currency === "ZAR" ? "R" : currency;
  const reportDate = new Date().toLocaleDateString();

  const metricBoxes: { key: string; label: string; value: string }[] = [
    { key: "irr", label: "IRR", value: `${metrics.irr.toFixed(2)}%` },
    { key: "netYieldPreTax", label: "Net Yield (pre-tax)", value: `${metrics.netYieldPreTax.toFixed(2)}%` },
    { key: "capRatePP", label: "Cap Rate (PP)", value: `${metrics.capRatePP.toFixed(2)}%` },
    { key: "npv", label: "NPV", value: fmt(metrics.npv, currencySymbol) },
    { key: "capRateMV", label: "Cap Rate (MV)", value: `${metrics.capRateMV.toFixed(2)}%` },
    { key: "dscr", label: "Debt Service Ratio", value: `${metrics.dscr.toFixed(2)}x` },
    { key: "operatingExpenseRatio", label: "Operating Expense Ratio", value: `${metrics.operatingExpenseRatio.toFixed(2)}%` },
    {
      key: "paybackPeriod",
      label: "Payback Period",
      value: isFinite(metrics.paybackPeriod) ? `${metrics.paybackPeriod.toFixed(1)} Yrs` : "--",
    },
  ];

  const highlightYears = [1, 5, 10, 15, 20];

  return (
    <Document>
      <Page size="A4" style={styles.coverPage}>
        <ShieldLogo />
        <Text style={styles.coverTitle}>AssetVerdict</Text>
        <Text style={styles.coverTagline}>Know Before You Commit.</Text>
        <Text style={styles.coverDealName}>{dealName}</Text>
        {address && <Text style={styles.coverAddress}>{address}</Text>}
        <Text style={{ fontSize: 10, color: COLORS.gold }}>Scenario: {scenarioLabel}</Text>
        <Text style={styles.coverFooter}>
          Prepared by AssetVerdict — Know Before You Commit.{"\n"}Report date: {reportDate}
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Key Metrics</Text>
        <View style={styles.metricGrid}>
          {metricBoxes.map((box) => {
            const numeric = parseFloat(box.value);
            const color = box.key === "npv"
              ? metrics.npv >= 0 ? COLORS.green : COLORS.red
              : !isNaN(numeric)
                ? colorFor(box.key, numeric)
                : COLORS.slate;
            return (
              <View key={box.key} style={styles.metricBox}>
                <View style={[styles.metricColorBar, { backgroundColor: color }]} />
                <Text style={styles.metricLabel}>{box.label}</Text>
                <Text style={styles.metricValue}>{box.value}</Text>
              </View>
            );
          })}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Cashflow Summary</Text>

        <Text style={styles.h2}>Annual Cashflow</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Gross Revenue</Text>
            <Text style={styles.tableHeaderCell}>Operating Costs</Text>
            <Text style={styles.tableHeaderCell}>Provisions</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>{fmt(metrics.revenueMonthly.total * 12, currencySymbol)}</Text>
            <Text style={styles.tableCell}>{fmt(metrics.operatingCostsMonthly.total * 12, currencySymbol)}</Text>
            <Text style={styles.tableCell}>{fmt(metrics.provisionsMonthly.total * 12, currencySymbol)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tax (annual)</Text>
          <Text style={styles.value}>{fmt(metrics.taxMonthly * 12, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Net Cashflow (annual)</Text>
          <Text style={styles.value}>{fmt(metrics.cashflowMonthly * 12, currencySymbol)}</Text>
        </View>

        <Text style={styles.h2}>20-Year Projection</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Year</Text>
            <Text style={styles.tableHeaderCell}>Revenue</Text>
            <Text style={styles.tableHeaderCell}>Costs</Text>
            <Text style={styles.tableHeaderCell}>Cashflow</Text>
            <Text style={styles.tableHeaderCell}>ROI%</Text>
          </View>
          {projection
            .filter((p) => highlightYears.includes(p.year))
            .map((p) => (
              <View style={styles.tableRow} key={p.year}>
                <Text style={styles.tableCell}>{p.year}</Text>
                <Text style={styles.tableCell}>{fmt(p.grossRevenue, currencySymbol)}</Text>
                <Text style={styles.tableCell}>{fmt(p.operatingCosts + p.financeCost, currencySymbol)}</Text>
                <Text style={styles.tableCell}>{fmt(p.cashflowForPeriod, currencySymbol)}</Text>
                <Text style={styles.tableCell}>{p.yearlyROI.toFixed(1)}%</Text>
              </View>
            ))}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Deal Inputs Summary</Text>

        <Text style={styles.h2}>Acquisition</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Asking Price</Text>
          <Text style={styles.value}>{fmt(dealSummary.askingPrice, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Purchase Price</Text>
          <Text style={styles.value}>{fmt(dealSummary.purchasePrice, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Market Value</Text>
          <Text style={styles.value}>{fmt(dealSummary.marketValue, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Transfer & Bond Cost</Text>
          <Text style={styles.value}>{fmt(dealSummary.transferBondCost, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Renovation Cost</Text>
          <Text style={styles.value}>{fmt(dealSummary.renovationCost, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Sourcing Fee</Text>
          <Text style={styles.value}>{fmt(dealSummary.sourcingFee, currencySymbol)}</Text>
        </View>

        <Text style={styles.h2}>Finance</Text>
        {dealSummary.financeSources.length === 0 && (
          <Text style={styles.label}>No finance sources added.</Text>
        )}
        {dealSummary.financeSources.map((f, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.label}>
              {f.sourceType} ({f.interestRate}%, {f.termYears}Y)
            </Text>
            <Text style={styles.value}>
              {fmt(f.loanAmount, currencySymbol)} → {fmt(f.repaymentAmount, currencySymbol)}/mo
            </Text>
          </View>
        ))}

        <Text style={styles.h2}>Cashflow</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Monthly Rent</Text>
          <Text style={styles.value}>{fmt(dealSummary.monthlyRent, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Occupancy Rate</Text>
          <Text style={styles.value}>
            {dealSummary.occupancyRate !== null ? `${dealSummary.occupancyRate}%` : "--"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
