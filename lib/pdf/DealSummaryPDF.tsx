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
import { isFiniteNumber } from "@/lib/calculations";
import type { DealSummaryInputs } from "@/hooks/useDealMetrics";
import type { Scenarios } from "@/lib/calculations/scenarios";
import type { RenovationItem, PropertyValuation, SuburbProfile } from "@/types";
import { getGaugeColorForStrategy } from "@/lib/calculations/thresholds";
import { getStrategy } from "@/lib/strategies";

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
  coverTagline: { fontSize: 12, color: COLORS.gold, marginBottom: 30 },
  coverDealName: { fontSize: 20, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  coverAddress: { fontSize: 11, color: "#CBD5E0", marginBottom: 10 },
  coverFooter: { position: "absolute", bottom: 60, fontSize: 9, color: "#CBD5E0" },
  h1: { fontSize: 18, marginBottom: 16, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 13, marginBottom: 10, marginTop: 18, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: COLORS.slate, marginBottom: 16 },
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
  tableCellSmall: { flex: 1, padding: 4, fontSize: 7.5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label: { color: COLORS.slate },
  value: { fontFamily: "Helvetica-Bold" },
  twoCol: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
});

function fmt(n: number | null | undefined, currency = "R") {
  if (n === null || n === undefined) return "--";
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function ShieldLogo() {
  return (
    <Svg width={40} height={40} viewBox="0 0 32 32">
      <Path
        d="M16 2 L28 7 V15 C28 22.5 22.8 27.8 16 30 C9.2 27.8 4 22.5 4 15 V7 L16 2 Z"
        stroke={COLORS.gold}
      />
      <Path d="M10.5 15.5 L14 19 L21.5 11" stroke={COLORS.gold} />
    </Svg>
  );
}

interface DealSummaryPDFProps {
  dealName: string;
  address?: string | null;
  currency: string;
  strategyId: string;
  activeScenario: "bear" | "base" | "bull";
  scenarios: Scenarios;
  dealSummary: DealSummaryInputs;
  renovationItems?: RenovationItem[];
  propertyValuation?: PropertyValuation | null;
  suburbProfile?: SuburbProfile | null;
}

const SCENARIO_COLORS = { bear: COLORS.red, base: COLORS.gold, bull: COLORS.green };
const SCENARIO_LABELS = { bear: "🐻 BEAR", base: "⚖️ BASE", bull: "🐂 BULL" };

const COMPARISON_ROWS: {
  label: string;
  key: keyof DealMetrics;
  metricKey: string;
  unit: "%" | "x" | "Yrs" | "R";
}[] = [
  { label: "IRR", key: "irr", metricKey: "irr", unit: "%" },
  { label: "Net Yield Yr 1", key: "netYieldPreTax", metricKey: "netYieldPreTax", unit: "%" },
  { label: "Gross Yield", key: "grossYield", metricKey: "grossYield", unit: "%" },
  { label: "Cap Rate (PP)", key: "capRatePP", metricKey: "capRatePP", unit: "%" },
  { label: "NPV", key: "npv", metricKey: "npv", unit: "R" },
  { label: "DSCR", key: "dscr", metricKey: "dscr", unit: "x" },
  { label: "Op. Expense Ratio", key: "operatingExpenseRatio", metricKey: "operatingExpenseRatio", unit: "%" },
  { label: "Payback Period", key: "paybackPeriod", metricKey: "paybackPeriod", unit: "Yrs" },
  { label: "Monthly Cashflow", key: "cashflowMonthly", metricKey: "cashflowMonthly", unit: "R" },
  { label: "NOI Margin", key: "noiMargin", metricKey: "noiMargin", unit: "%" },
];

function formatMetricValue(value: number, unit: string, currency: string) {
  if (!isFiniteNumber(value)) return "--";
  if (unit === "R") return fmt(value, currency);
  if (unit === "x") return `${value.toFixed(2)}x`;
  if (unit === "Yrs") return `${value.toFixed(1)} Yrs`;
  return `${value.toFixed(2)}%`;
}

export default function DealSummaryPDF({
  dealName,
  address,
  currency,
  strategyId,
  activeScenario,
  scenarios,
  dealSummary,
  renovationItems = [],
  propertyValuation = null,
  suburbProfile = null,
}: DealSummaryPDFProps) {
  const currencySymbol = currency === "ZAR" ? "R" : currency;
  const reportDate = new Date().toLocaleDateString("en-US");
  const strategy = getStrategy(strategyId);
  const isFlip = strategyId === "fix_and_flip";

  const metrics = scenarios[activeScenario].metrics;
  const scenarioLabel = `${activeScenario[0].toUpperCase()}${activeScenario.slice(1)} Case`;

  const highlightYears = [1, 5, 10, 15, 20];

  const metricBoxes: { key: string; label: string; value: string }[] = isFlip && metrics.flipMetrics
    ? [
        { key: "netProfit", label: "Net Profit", value: fmt(metrics.flipMetrics.netProfit, currencySymbol) },
        { key: "roi", label: "ROI", value: `${metrics.flipMetrics.roi.toFixed(1)}%` },
        { key: "annualisedRoi", label: "Annualised ROI", value: `${metrics.flipMetrics.annualisedROI.toFixed(1)}%` },
        { key: "totalCost", label: "Total Cost", value: fmt(metrics.flipMetrics.totalCost, currencySymbol) },
      ]
    : [
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
          value: isFiniteNumber(metrics.paybackPeriod)
            ? `${metrics.paybackPeriod.toFixed(1)} Yrs`
            : "--",
        },
      ];

  return (
    <Document>
      {/* PAGE 1 — Cover */}
      <Page size="A4" style={styles.coverPage}>
        <ShieldLogo />
        <Text style={styles.coverTitle}>AssetVerdict</Text>
        <Text style={styles.coverTagline}>Know Before You Commit.</Text>
        <Text style={styles.coverDealName}>{dealName}</Text>
        {address && <Text style={styles.coverAddress}>{address}</Text>}
        <Text style={{ fontSize: 10, color: COLORS.gold, marginBottom: 4 }}>
          {strategy.icon} {strategy.label}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.gold }}>Active Scenario: {scenarioLabel}</Text>
        <Text style={styles.coverFooter}>
          Prepared by AssetVerdict — Know Before You Commit.{"\n"}Report date: {reportDate}
        </Text>
      </Page>

      {/* PAGE 2 — Scenario Comparison */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Bear / Base / Bull — Scenario Comparison</Text>
        <Text style={styles.subtitle}>
          Bear and Bull adjust rental growth, capital growth, and occupancy down/up by your
          configured sensitivity factors. Base reflects your modelled inputs as entered.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Metric</Text>
            {(["bear", "base", "bull"] as const).map((s) => (
              <Text
                key={s}
                style={[styles.tableHeaderCell, { color: SCENARIO_COLORS[s] }]}
              >
                {SCENARIO_LABELS[s]}
              </Text>
            ))}
          </View>
          {COMPARISON_ROWS.map((row) => (
            <View style={styles.tableRow} key={row.key}>
              <Text style={styles.tableCell}>{row.label}</Text>
              {(["bear", "base", "bull"] as const).map((s) => {
                const value = scenarios[s].metrics[row.key] as number;
                const color = getGaugeColorForStrategy(row.metricKey, value, strategyId);
                return (
                  <Text key={s} style={[styles.tableCell, { color: COLORS[color] }]}>
                    {formatMetricValue(value, row.unit, currencySymbol)}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Cashflow at Key Milestones</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Year</Text>
            <Text style={[styles.tableHeaderCell, { color: SCENARIO_COLORS.bear }]}>Bear</Text>
            <Text style={[styles.tableHeaderCell, { color: SCENARIO_COLORS.base }]}>Base</Text>
            <Text style={[styles.tableHeaderCell, { color: SCENARIO_COLORS.bull }]}>Bull</Text>
          </View>
          {[1, 5, 10, 20].map((year) => (
            <View style={styles.tableRow} key={year}>
              <Text style={styles.tableCell}>Year {year}</Text>
              {(["bear", "base", "bull"] as const).map((s) => {
                const p = scenarios[s].projection.find((pr) => pr.year === year);
                return (
                  <Text key={s} style={styles.tableCell}>
                    {p ? fmt(p.cashflowForPeriod, currencySymbol) : "--"}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      </Page>

      {/* PAGE 3 — Base Case Key Metrics */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{scenarioLabel} — Key Metrics</Text>
        <View style={styles.metricGrid}>
          {metricBoxes.map((box) => {
            const numeric = parseFloat(box.value);
            const color =
              box.key === "npv" || box.key === "netProfit"
                ? (isFlip ? metrics.flipMetrics!.netProfit : metrics.npv) >= 0
                  ? COLORS.green
                  : COLORS.red
                : box.key === "totalCost"
                  ? COLORS.slate
                  : !isNaN(numeric)
                    ? COLORS[getGaugeColorForStrategy(box.key, numeric, strategyId)]
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

      {/* PAGE 4 — Cashflow Summary */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Cashflow Summary (Monthly)</Text>

        <Text style={styles.h2}>{scenarioLabel}</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell}>Gross Revenue</Text>
            <Text style={styles.tableHeaderCell}>Operating Costs</Text>
            <Text style={styles.tableHeaderCell}>Provisions</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>{fmt(metrics.revenueMonthly.total, currencySymbol)}</Text>
            <Text style={styles.tableCell}>{fmt(metrics.operatingCostsMonthly.total, currencySymbol)}</Text>
            <Text style={styles.tableCell}>{fmt(metrics.provisionsMonthly.total, currencySymbol)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tax</Text>
          <Text style={styles.value}>{fmt(metrics.taxMonthly, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Net Cashflow</Text>
          <Text style={styles.value}>{fmt(metrics.cashflowMonthly, currencySymbol)}</Text>
        </View>

        <Text style={styles.h2}>Bear vs Bull</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHeaderCell} />
            <Text style={[styles.tableHeaderCell, { color: SCENARIO_COLORS.bear }]}>Bear</Text>
            <Text style={[styles.tableHeaderCell, { color: SCENARIO_COLORS.bull }]}>Bull</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Gross Revenue</Text>
            <Text style={styles.tableCell}>{fmt(scenarios.bear.metrics.revenueMonthly.total, currencySymbol)}</Text>
            <Text style={styles.tableCell}>{fmt(scenarios.bull.metrics.revenueMonthly.total, currencySymbol)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Operating Costs</Text>
            <Text style={styles.tableCell}>{fmt(scenarios.bear.metrics.operatingCostsMonthly.total, currencySymbol)}</Text>
            <Text style={styles.tableCell}>{fmt(scenarios.bull.metrics.operatingCostsMonthly.total, currencySymbol)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Net Cashflow</Text>
            <Text style={styles.tableCell}>{fmt(scenarios.bear.metrics.cashflowMonthly, currencySymbol)}</Text>
            <Text style={styles.tableCell}>{fmt(scenarios.bull.metrics.cashflowMonthly, currencySymbol)}</Text>
          </View>
        </View>
      </Page>

      {/* PAGE 5 — 20-Year Projection, all 3 scenarios */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>20-Year Cashflow Projection</Text>
        {(["bear", "base", "bull"] as const).map((s) => (
          <View key={s} wrap={false}>
            <Text style={[styles.h2, { color: SCENARIO_COLORS[s] }]}>{SCENARIO_LABELS[s]}</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableCellSmall}>Year</Text>
                <Text style={styles.tableCellSmall}>Revenue</Text>
                <Text style={styles.tableCellSmall}>Costs</Text>
                <Text style={styles.tableCellSmall}>Cashflow</Text>
                <Text style={styles.tableCellSmall}>Cum. Cashflow</Text>
                <Text style={styles.tableCellSmall}>ROI%</Text>
              </View>
              {scenarios[s].projection
                .filter((p: YearlyProjection) => highlightYears.includes(p.year))
                .map((p: YearlyProjection) => (
                  <View style={styles.tableRow} key={p.year}>
                    <Text style={styles.tableCellSmall}>{p.year}</Text>
                    <Text style={styles.tableCellSmall}>{fmt(p.grossRevenue, currencySymbol)}</Text>
                    <Text style={styles.tableCellSmall}>{fmt(p.operatingCosts + p.financeCost, currencySymbol)}</Text>
                    <Text style={styles.tableCellSmall}>{fmt(p.cashflowForPeriod, currencySymbol)}</Text>
                    <Text style={styles.tableCellSmall}>{fmt(p.cumulativeCashflow, currencySymbol)}</Text>
                    <Text style={styles.tableCellSmall}>{p.yearlyROI.toFixed(1)}%</Text>
                  </View>
                ))}
            </View>
          </View>
        ))}
      </Page>

      {/* PAGE 6 — Property Details */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Property Details</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <View style={styles.row}>
              <Text style={styles.label}>Erf Number</Text>
              <Text style={styles.value}>{dealSummary.erfNumber ?? "--"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Erf Size</Text>
              <Text style={styles.value}>{dealSummary.erfSize ? `${dealSummary.erfSize} m²` : "--"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Floor Size</Text>
              <Text style={styles.value}>{dealSummary.floorSize ? `${dealSummary.floorSize} m²` : "--"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Year Built</Text>
              <Text style={styles.value}>{dealSummary.yearBuilt ?? "--"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Property Zoning</Text>
              <Text style={styles.value}>{dealSummary.propertyZoning ?? "--"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Title Deed No.</Text>
              <Text style={styles.value}>{dealSummary.titleDeedNumber ?? "--"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Rates Account No.</Text>
              <Text style={styles.value}>{dealSummary.ratesAccountNumber ?? "--"}</Text>
            </View>
            {(dealSummary.bedrooms || dealSummary.bathrooms || dealSummary.garages) && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Bedrooms / Bathrooms</Text>
                  <Text style={styles.value}>
                    {dealSummary.bedrooms ?? "--"} / {dealSummary.bathrooms ?? "--"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Garages / Units</Text>
                  <Text style={styles.value}>
                    {dealSummary.garages ?? "--"} / {dealSummary.numUnits ?? "--"}
                  </Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.col}>
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
            {dealSummary.isSectionalTitle && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Unit No. / Scheme</Text>
                  <Text style={styles.value}>
                    {dealSummary.unitNumber ?? "--"} / {dealSummary.schemeName ?? "--"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Monthly Levy</Text>
                  <Text style={styles.value}>{fmt(dealSummary.schemeLevy, currencySymbol)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <Text style={styles.h2}>Renovation Summary</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 8 }}>
          Total Renovation Cost: {fmt(dealSummary.renovationCost, currencySymbol)}
        </Text>
        {renovationItems.length === 0 ? (
          <Text style={styles.label}>No renovation items added.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellSmall}>Category</Text>
              <Text style={styles.tableCellSmall}>Description</Text>
              <Text style={styles.tableCellSmall}>Budgeted</Text>
              <Text style={styles.tableCellSmall}>Quoted</Text>
              <Text style={styles.tableCellSmall}>Status</Text>
            </View>
            {renovationItems.map((item) => (
              <View style={styles.tableRow} key={item.id}>
                <Text style={styles.tableCellSmall}>{item.category}</Text>
                <Text style={styles.tableCellSmall}>{item.description}</Text>
                <Text style={styles.tableCellSmall}>{fmt(item.budgeted, currencySymbol)}</Text>
                <Text style={styles.tableCellSmall}>{fmt(item.quoted, currencySymbol)}</Text>
                <Text style={styles.tableCellSmall}>{item.status}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>

      {/* PAGE 7 — Deal Inputs */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Deal Inputs</Text>

        <Text style={styles.h2}>Acquisition</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Transfer & Bond Cost</Text>
          <Text style={styles.value}>{fmt(dealSummary.transferBondCost, currencySymbol)}</Text>
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

      {(propertyValuation || suburbProfile) && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Area Intelligence</Text>

          {propertyValuation && (
            <>
              <Text style={styles.h2}>Property Valuation (Tier 1)</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Estimated Value (AVM)</Text>
                <Text style={styles.value}>{fmt(propertyValuation.estimatedValue, currencySymbol)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Confidence</Text>
                <Text style={styles.value}>{propertyValuation.valuationConfidence ?? "--"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Building Size</Text>
                <Text style={styles.value}>
                  {propertyValuation.buildingSizeSqm ? `${propertyValuation.buildingSizeSqm} m²` : "--"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Comparable Sales Captured</Text>
                <Text style={styles.value}>{propertyValuation.comparables.length}</Text>
              </View>
            </>
          )}

          {suburbProfile && (
            <>
              <Text style={styles.h2}>
                Suburb Profile — {suburbProfile.suburbName} (Tier 2/3)
              </Text>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <View style={styles.row}>
                    <Text style={styles.label}>ST Gross Yield</Text>
                    <Text style={styles.value}>
                      {suburbProfile.stGrossYield !== null && suburbProfile.stGrossYield !== undefined
                        ? `${suburbProfile.stGrossYield}%`
                        : "--"}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>FH Gross Yield</Text>
                    <Text style={styles.value}>
                      {suburbProfile.fhGrossYield !== null && suburbProfile.fhGrossYield !== undefined
                        ? `${suburbProfile.fhGrossYield}%`
                        : "--"}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Good Standing (Suburb)</Text>
                    <Text style={styles.value}>
                      {suburbProfile.goodStandingPct !== null && suburbProfile.goodStandingPct !== undefined
                        ? `${suburbProfile.goodStandingPct}%`
                        : "--"}
                    </Text>
                  </View>
                </View>
                <View style={styles.col}>
                  <View style={styles.row}>
                    <Text style={styles.label}>FH 3Bed Avg Rent</Text>
                    <Text style={styles.value}>{fmt(suburbProfile.fh3BedAvg, currencySymbol)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>ST 2Bed Avg Rent</Text>
                    <Text style={styles.value}>{fmt(suburbProfile.st2BedAvg, currencySymbol)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Report Year</Text>
                    <Text style={styles.value}>{suburbProfile.reportYear ?? "--"}</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </Page>
      )}
    </Document>
  );
}
