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
import { calcFurnitureItemResult, CONTINGENCY_CATEGORY } from "@/lib/calculations/furnitureCosts";
import { getGaugeColorForStrategy, type GaugeVisualColor } from "@/lib/calculations/thresholds";
import {
  getMetricApplicability,
  applicabilityContextFromMetrics,
} from "@/lib/calculations/applicability";
import { getStrategy } from "@/lib/strategies";
import type { DealVerdictResult, VerdictLabel } from "@/lib/calculations/verdict";
import { getVerdictLabelCopy, VERDICT_UNAVAILABLE_COPY, formatVerdictReason } from "@/lib/education/verdictCopy";
import type { NegotiationAnalysis, NegotiationObjective, NegotiationOpportunity } from "@/lib/calculations/negotiation";
import type { FlipExitValueAnalysis, FlipExitValueConservativeCase, FlipSalePriceScenarioSummary } from "@/lib/calculations/fixFlipExitValue";
import {
  NEGOTIATION_OBJECTIVE_LABEL,
  NEGOTIATION_UNAVAILABLE_COPY,
  NEGOTIATION_OPPORTUNITY_TITLE,
  NEGOTIATION_OPPORTUNITY_DISCLAIMER,
  UNSUPPORTED_FINANCING_STRUCTURE_EXPLAINER,
  FIXED_LTV_ASSUMPTION_EXPLAINER,
  describeNegotiationResult,
  describeNegotiationOpportunity,
} from "@/lib/education/negotiationCopy";

const COLORS = {
  navy: "#0F1F3D",
  gold: "#C9A84C",
  slate: "#4A5568",
  green: "#27AE60",
  orange: "#E67E22",
  red: "#E74C3C",
  lightGrey: "#EDF2F7",
  // Matches GaugeDial's "grey" (no data / no calibrated benchmark) token.
  neutral: "#CBD5E0",
};

/** Visual colour hex for a gauge-style value — "neutral" for metrics with no calibrated AssetVerdict threshold, never amber (Phase 3.1). */
const GAUGE_COLOR_HEX: Record<GaugeVisualColor, string> = {
  green: COLORS.green,
  orange: COLORS.orange,
  red: COLORS.red,
  neutral: COLORS.neutral,
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
  verdictBox: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  verdictTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  verdictDescription: { fontSize: 9, color: COLORS.slate, marginBottom: 8 },
  verdictReasonsLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.navy, marginBottom: 4 },
  verdictReason: { fontSize: 8.5, color: COLORS.slate, marginBottom: 2 },
  verdictFootnote: { fontSize: 7.5, color: COLORS.slate, marginTop: 8 },
  negotiationBox: { borderWidth: 1, borderColor: COLORS.lightGrey, borderRadius: 4, padding: 12, marginBottom: 16 },
  negotiationTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  negotiationAsking: { fontSize: 9, color: COLORS.slate, marginBottom: 8 },
  negotiationRow: { marginBottom: 6 },
  negotiationObjectiveLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: COLORS.navy },
  negotiationObjectiveValue: { fontSize: 9.5, marginTop: 1 },
  negotiationObjectiveDetail: { fontSize: 8, color: COLORS.slate, marginTop: 1 },
  opportunityBox: { borderWidth: 1, borderColor: COLORS.lightGrey, borderRadius: 4, padding: 10, marginBottom: 12 },
  opportunityLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COLORS.slate, marginBottom: 2 },
  opportunityTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  opportunityDescription: { fontSize: 8.5, color: COLORS.slate, marginBottom: 6 },
  opportunityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  opportunityFieldLabel: { fontSize: 7, color: COLORS.slate, textTransform: "uppercase" },
  opportunityFieldValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: COLORS.navy, marginTop: 1 },
  flipBox: { borderWidth: 1, borderColor: COLORS.lightGrey, borderRadius: 4, padding: 12, marginTop: 16 },
  flipBoxTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
});

/**
 * Distinct from GAUGE_COLOR_HEX (Strong/Caution/Weak) — Phase 4.14 section
 * 93 requires "Does Not Meet Target" to visually differ from "High Risk",
 * not just read as a lighter shade of the same danger colour.
 */
const VERDICT_COLOR_HEX: Record<VerdictLabel, string> = {
  strong: COLORS.green,
  promising: COLORS.gold,
  promising_if_negotiated: COLORS.gold,
  high_risk: COLORS.red,
  does_not_meet_target: COLORS.navy,
};

function fmt(n: number | null | undefined, currency = "R") {
  if (n === null || n === undefined) return "--";
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** One Point/Conservative scenario box (Phase 4.19) — reads only fields already computed by fixFlipExitValue.ts, no PDF-local arithmetic. */
function renderFlipScenarioBox(
  title: string,
  scenarioCase: { salePrice: number; summary: FlipSalePriceScenarioSummary } | FlipExitValueConservativeCase,
  currencySymbol: string
) {
  const { summary } = scenarioCase;
  const conservativeFields = "survivesConservativeCase" in scenarioCase ? (scenarioCase as FlipExitValueConservativeCase) : null;
  return (
    <View style={styles.flipBox} key={title}>
      <Text style={styles.flipBoxTitle}>{title}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Sale Price</Text>
        <Text style={styles.value}>{fmt(scenarioCase.salePrice, currencySymbol)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Estimated Profit Before Tax</Text>
        <Text style={styles.value}>{fmt(summary.estimatedProfitBeforeTax, currencySymbol)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Pre-Tax Project ROI</Text>
        <Text style={styles.value}>{summary.preTaxProjectROI.toFixed(1)}%</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Equity IRR</Text>
        <Text style={styles.value}>{summary.equityIRR === null ? "N/A" : `${summary.equityIRR.toFixed(1)}%`}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sale-Price Buffer</Text>
        <Text style={styles.value}>
          {summary.salePriceBufferPercent === null
            ? "N/A"
            : `${fmt(summary.salePriceBufferRand, currencySymbol)} (${summary.salePriceBufferPercent.toFixed(1)}%)`}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Target vs. Required Return</Text>
        <Text style={styles.value}>{summary.targetState === "met" ? "Met" : summary.targetState === "missed" ? "Missed" : "Unknown"}</Text>
      </View>
      {conservativeFields && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Remains profitable at this price</Text>
            <Text style={styles.value}>{conservativeFields.survivesConservativeCase ? "Yes" : "No"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Still meets Required Return</Text>
            <Text style={styles.value}>
              {conservativeFields.meetsRequiredReturnInConservativeCase === null
                ? "N/A"
                : conservativeFields.meetsRequiredReturnInConservativeCase
                ? "Yes"
                : "No"}
            </Text>
          </View>
        </>
      )}
    </View>
  );
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
  /** The investor's required annual return (DealInputs.discountRate) — needed to classify Equity IRR, Cash-on-Cash Return, and Equity NPV (Phase 4.1, target-/zero-relative models). */
  discountRate: number;
  /** Pre-computed by the caller (Phase 4.14) — the same deterministic verdict the Summary page shows, never recalculated here. */
  verdict: DealVerdictResult;
  /** Pre-computed by the caller (Phase 4.15) — the same deterministic negotiation analysis the Summary page shows, never recalculated here. Optional so a PDF can still render if this fetch failed. */
  negotiation?: NegotiationAnalysis | null;
  /** Pre-computed by the caller (Phase 4.16) — the same conditional Negotiation Opportunity status the Summary page shows, never recalculated here. */
  opportunity?: NegotiationOpportunity | null;
  dealSummary: DealSummaryInputs;
  renovationItems?: RenovationItem[];
  propertyValuation?: PropertyValuation | null;
  suburbProfile?: SuburbProfile | null;
  /** Pre-computed by the caller (Phase 4.19) — the same deterministic exit-value evidence/scenario model the Summary page shows, never recalculated here. Fix & Flip only. */
  fixFlipExitValueAnalysis?: FlipExitValueAnalysis;
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
  { label: "Cash-on-Cash Return", key: "netYieldPreTax", metricKey: "netYieldPreTax", unit: "%" },
  { label: "Gross Yield", key: "grossYield", metricKey: "grossYield", unit: "%" },
  { label: "Cap Rate (PP)", key: "capRatePP", metricKey: "capRatePP", unit: "%" },
  { label: "NPV", key: "npv", metricKey: "npv", unit: "R" },
  { label: "DSCR", key: "dscr", metricKey: "dscr", unit: "x" },
  // Phase 4.23.1: three separately-named leverage metrics — Purchase LTV
  // keeps its real gauge colour (verdict-facing, calibrated bands);
  // Estimated Value LTV / Project Leverage automatically render with no
  // colour (getGaugeColorForStrategy returns "neutral" for any metric with
  // no threshold definition — see thresholds.ts) since no bands exist for
  // them, never a fabricated judgement.
  { label: "Purchase LTV", key: "purchaseLtv", metricKey: "purchaseLtv", unit: "%" },
  { label: "Estimated Value LTV", key: "estimatedValueLtv", metricKey: "estimatedValueLtv", unit: "%" },
  { label: "Project Leverage", key: "projectLeverage", metricKey: "projectLeverage", unit: "%" },
  { label: "Op. Expense Ratio", key: "operatingExpenseRatio", metricKey: "operatingExpenseRatio", unit: "%" },
  { label: "Payback Period", key: "paybackPeriod", metricKey: "paybackPeriod", unit: "Yrs" },
  { label: "Monthly Cashflow", key: "cashflowMonthly", metricKey: "cashflowMonthly", unit: "R" },
  { label: "NOI Margin", key: "noiMargin", metricKey: "noiMargin", unit: "%" },
];

const NEGOTIATION_FIELD_BY_OBJECTIVE: Record<
  NegotiationObjective,
  keyof Pick<NegotiationAnalysis, "meetRequiredReturn" | "clearStructuralSafety" | "reachPromising" | "reachStrong">
> = {
  meet_required_return: "meetRequiredReturn",
  clear_structural_safety: "clearStructuralSafety",
  reach_promising: "reachPromising",
  reach_strong: "reachStrong",
};

function toNegotiationField(objective: NegotiationObjective) {
  return NEGOTIATION_FIELD_BY_OBJECTIVE[objective];
}

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
  discountRate,
  verdict,
  negotiation = null,
  opportunity = null,
  dealSummary,
  renovationItems = [],
  propertyValuation = null,
  suburbProfile = null,
  fixFlipExitValueAnalysis,
}: DealSummaryPDFProps) {
  const currencySymbol = currency === "ZAR" ? "R" : currency;
  const reportDate = new Date().toLocaleDateString("en-US");
  const strategy = getStrategy(strategyId);
  const isFlip = strategyId === "fix_and_flip";

  const metrics = scenarios[activeScenario].metrics;
  const scenarioLabel = `${activeScenario[0].toUpperCase()}${activeScenario.slice(1)} Case`;

  // Equity IRR, Equity NPV, Net Yield (Cash-on-Cash), and Equity Payback
  // Period are denominated in the investor's own equity, not total cost —
  // not applicable for a fully/over-financed deal. Financing (and therefore
  // equity) doesn't change between bear/base/bull scenarios, so this is safe
  // to compute once. See lib/calculations/applicability.ts.
  const metricsApplicabilityCtx = applicabilityContextFromMetrics(metrics);
  const equityApplicable = getMetricApplicability(
    "irr",
    metricsApplicabilityCtx
  ).applicable;

  const highlightYears = [1, 5, 10, 15, 20];

  const metricBoxes: { key: string; label: string; value: string }[] = isFlip && metrics.flipMetrics
    ? [
        { key: "netProfit", label: "Estimated Profit Before Tax", value: fmt(metrics.flipMetrics.netProfit, currencySymbol) },
        { key: "roi", label: "Pre-Tax ROI", value: `${metrics.flipMetrics.roi.toFixed(1)}%` },
        {
          // Phase 4.17.1: flipMetrics.annualisedROI is itself the
          // compounding-equivalent figure now (shares its formula with
          // fixFlipAnalysis.profitability.annualisedPreTaxROI), and is
          // null — not a misleading 0% or stale linear number — exactly
          // when fixFlipAnalysis would also say N/A. One field is enough.
          key: "annualisedROI",
          label: "Annualised Pre-Tax ROI",
          value: metrics.flipMetrics.annualisedROI === null ? "N/A" : `${metrics.flipMetrics.annualisedROI.toFixed(1)}%`,
        },
        { key: "totalCost", label: "Total Cost", value: fmt(metrics.flipMetrics.totalCost, currencySymbol) },
      ]
    : [
        {
          key: "irr",
          label: "IRR (Equity)",
          value: equityApplicable ? `${metrics.irr.toFixed(2)}%` : "N/A (no equity invested)",
        },
        {
          key: "netYieldPreTax",
          label: "Cash-on-Cash Return (Pre-Tax)",
          value: equityApplicable ? `${metrics.netYieldPreTax.toFixed(2)}%` : "N/A (no equity invested)",
        },
        { key: "capRatePP", label: "Cap Rate (PP)", value: `${metrics.capRatePP.toFixed(2)}%` },
        {
          key: "npv",
          label: "NPV (Equity)",
          value: equityApplicable ? fmt(metrics.npv, currencySymbol) : "N/A (no equity invested)",
        },
        { key: "capRateMV", label: "Cap Rate (MV)", value: `${metrics.capRateMV.toFixed(2)}%` },
        {
          key: "dscr",
          label: "DSCR (Debt Service Coverage Ratio)",
          value: isFiniteNumber(metrics.dscr) ? `${metrics.dscr.toFixed(2)}x` : "N/A (no debt)",
        },
        { key: "operatingExpenseRatio", label: "Operating Expense Ratio", value: `${metrics.operatingExpenseRatio.toFixed(2)}%` },
        {
          key: "paybackPeriod",
          label: "Payback Period",
          value:
            equityApplicable && isFiniteNumber(metrics.paybackPeriod)
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

      {/* PAGE 2 — Overall Verdict + Scenario Comparison */}
      <Page size="A4" style={styles.page}>
        {verdict.status === "available" ? (
          <View
            style={[
              styles.verdictBox,
              { borderColor: VERDICT_COLOR_HEX[verdict.verdict], backgroundColor: `${VERDICT_COLOR_HEX[verdict.verdict]}12` },
            ]}
          >
            <Text style={[styles.verdictTitle, { color: VERDICT_COLOR_HEX[verdict.verdict] }]}>
              Overall Verdict: {getVerdictLabelCopy(verdict.verdict, strategyId).title}
            </Text>
            <Text style={styles.verdictDescription}>{getVerdictLabelCopy(verdict.verdict, strategyId).description}</Text>
            {(verdict.blockers.length > 0 ? verdict.blockers : verdict.reasons).length > 0 && (
              <>
                <Text style={styles.verdictReasonsLabel}>TOP REASONS</Text>
                {(verdict.blockers.length > 0 ? verdict.blockers : verdict.reasons)
                  .filter((r) => isFlip || r.severity === "blocking" || r.severity === "high" || r.severity === "moderate")
                  .slice(0, isFlip ? 4 : 3)
                  .map((r, i) => (
                    <Text key={`${r.code}-${i}`} style={styles.verdictReason}>
                      • {formatVerdictReason(r, currencySymbol)}
                    </Text>
                  ))}
              </>
            )}
            <Text style={styles.verdictFootnote}>
              Based on the Base case only, under the assumptions entered. Bear and Bull scenarios
              remain supporting context and do not currently change this verdict. Not investment
              advice.
            </Text>
          </View>
        ) : (
          <View style={[styles.verdictBox, { borderColor: COLORS.lightGrey, backgroundColor: COLORS.lightGrey }]}>
            <Text style={[styles.verdictTitle, { color: COLORS.slate, fontSize: 14 }]}>
              Overall Verdict: {VERDICT_UNAVAILABLE_COPY[verdict.reason].title}
            </Text>
            <Text style={styles.verdictDescription}>{VERDICT_UNAVAILABLE_COPY[verdict.reason].description}</Text>
          </View>
        )}

        {/* Negotiation Analysis (Phase 4.15 / 4.15.1) */}
        {negotiation && (
          <View style={styles.negotiationBox}>
            <Text style={styles.negotiationTitle}>Negotiation Analysis</Text>
            {negotiation.meetRequiredReturn.status === "unavailable" ? (
              <>
                <Text style={styles.negotiationAsking}>{NEGOTIATION_UNAVAILABLE_COPY[negotiation.meetRequiredReturn.reason]}</Text>
                {negotiation.meetRequiredReturn.reason === "unsupported_financing_structure" && (
                  <Text style={styles.negotiationObjectiveDetail}>{UNSUPPORTED_FINANCING_STRUCTURE_EXPLAINER}</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.negotiationAsking}>Asking Price: {fmt(negotiation.currentPrice, currencySymbol)}</Text>

                {opportunity && opportunity.status !== "unavailable" && (
                  <View style={styles.opportunityBox}>
                    <Text style={styles.opportunityLabel}>NEGOTIATION OPPORTUNITY</Text>
                    <Text style={styles.opportunityTitle}>{NEGOTIATION_OPPORTUNITY_TITLE[opportunity.status]}</Text>
                    <Text style={styles.opportunityDescription}>{describeNegotiationOpportunity(opportunity, currencySymbol)}</Text>
                    {opportunity.status === "promising_if_negotiated" && (
                      <>
                        <View style={styles.opportunityGrid}>
                          <View>
                            <Text style={styles.opportunityFieldLabel}>Maximum Price to Reach Strong</Text>
                            <Text style={styles.opportunityFieldValue}>{fmt(opportunity.targetPrice, currencySymbol)}</Text>
                          </View>
                          <View>
                            <Text style={styles.opportunityFieldLabel}>Reduction Required</Text>
                            <Text style={styles.opportunityFieldValue}>
                              {fmt(opportunity.reductionRand, currencySymbol)} ({opportunity.reductionPercent.toFixed(1)}%)
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.opportunityFieldLabel}>Result at Target Price</Text>
                            <Text style={[styles.opportunityFieldValue, { color: COLORS.green }]}>Strong</Text>
                          </View>
                        </View>
                        <Text style={styles.verdictFootnote}>{NEGOTIATION_OPPORTUNITY_DISCLAIMER}</Text>
                      </>
                    )}
                  </View>
                )}

                {(["meet_required_return", "clear_structural_safety", "reach_strong"] as NegotiationObjective[]).map(
                  (objective) => {
                    const result = negotiation[toNegotiationField(objective)];
                    return (
                      <View key={objective} style={styles.negotiationRow}>
                        <Text style={styles.negotiationObjectiveLabel}>{NEGOTIATION_OBJECTIVE_LABEL[objective]}</Text>
                        {(result.status === "already_meets" || result.status === "solvable") && (
                          <Text style={styles.negotiationObjectiveValue}>
                            {result.status === "already_meets"
                              ? "Already achieved — no discount required"
                              : fmt(result.targetPrice, currencySymbol)}
                          </Text>
                        )}
                        {result.status === "solvable" && (
                          <Text style={styles.negotiationObjectiveDetail}>
                            Reduction needed: {fmt(result.reductionRand, currencySymbol)} ({result.reductionPercent.toFixed(1)}%)
                          </Text>
                        )}
                        {(result.status === "not_achievable_by_price" || result.status === "unavailable") && (
                          <Text style={styles.negotiationObjectiveDetail}>{describeNegotiationResult(result, currencySymbol)}</Text>
                        )}
                      </View>
                    );
                  }
                )}
                <Text style={styles.verdictFootnote}>{FIXED_LTV_ASSUMPTION_EXPLAINER}</Text>
                <Text style={styles.verdictFootnote}>
                  These are mathematical target prices, not a prediction that the seller will accept them, and not
                  investment advice.
                </Text>
              </>
            )}
          </View>
        )}

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
                const rowMetrics = scenarios[s].metrics;
                const value = rowMetrics[row.key] as number;
                const rowCtx = applicabilityContextFromMetrics(rowMetrics);
                const applicable = getMetricApplicability(row.metricKey, rowCtx).applicable;
                if (!applicable) {
                  return (
                    <Text key={s} style={[styles.tableCell, { color: COLORS.slate }]}>
                      N/A
                    </Text>
                  );
                }
                const color =
                  GAUGE_COLOR_HEX[
                    getGaugeColorForStrategy(row.metricKey, value, strategyId, {
                      discountRate,
                      initialEquityInvestment: rowCtx.initialEquityInvestment,
                    })
                  ];
                return (
                  <Text key={s} style={[styles.tableCell, { color }]}>
                    {formatMetricValue(value, row.unit, currencySymbol)}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 7.5, color: COLORS.slate, marginTop: 4 }}>
          Purchase LTV, Estimated Value LTV, and Project Leverage measure three different things and
          are not interchangeable. Estimated Value LTV is based on the user-entered estimated current
          market value, not a bank-confirmed valuation — AssetVerdict does not classify or judge this
          figure, and it has no effect on the deal&apos;s verdict. Project Leverage is also
          informational only.
        </Text>

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
        {!isFlip && metrics.exitSummary && (
          <Text style={styles.subtitle}>
            {metrics.exitSummary.isPlannedSale
              ? `Planned Sale: Year ${metrics.exitSummary.holdPeriodYears} — IRR and NPV below exit at this year.`
              : `Analysis Horizon: ${metrics.exitSummary.holdPeriodYears} years — no planned sale entered, so IRR and NPV below use this AssetVerdict default.`}
          </Text>
        )}
        <View style={styles.metricGrid}>
          {metricBoxes.map((box) => {
            const numeric = parseFloat(box.value);
            const isEquityBox = box.key === "npv" || box.key === "irr" || box.key === "netYieldPreTax";
            // Net Profit and Total Cost are informational only — no
            // standalone Strong/Weak judgement (Decision 4, Phase 4.1). NPV
            // is genuinely classified (zero-relative, vs. the investor's
            // required return) and IRR/Cash-on-Cash are target-relative —
            // all three need discountRate/initialEquityInvestment, not a
            // raw sign check, and must respect the same N/A state already
            // shown in box.value ("N/A (no equity invested)") rather than
            // colouring a raw solver output that's inapplicable.
            const color =
              box.key === "netProfit" || box.key === "totalCost"
                ? COLORS.slate
                : isEquityBox
                  ? !equityApplicable
                    ? COLORS.slate
                    : GAUGE_COLOR_HEX[
                        getGaugeColorForStrategy(box.key, metrics[box.key as keyof DealMetrics] as number, strategyId, {
                          discountRate,
                          initialEquityInvestment: metricsApplicabilityCtx.initialEquityInvestment,
                        })
                      ]
                  : !isNaN(numeric)
                    ? GAUGE_COLOR_HEX[getGaugeColorForStrategy(box.key, numeric, strategyId)]
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

        {/* Fix & Flip financial breakdown (Phase 4.17) — same fixFlipAnalysis object the Summary UI reads, no duplicated arithmetic. */}
        {isFlip && metrics.fixFlipAnalysis?.status === "available" && (
          <>
            <View style={styles.flipBox}>
              <Text style={styles.flipBoxTitle}>Financing</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Total Loan Amount</Text>
                <Text style={styles.value}>{fmt(metrics.fixFlipAnalysis.financing.totalLoanAmount, currencySymbol)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Interest Paid During Hold</Text>
                <Text style={styles.value}>{fmt(metrics.fixFlipAnalysis.financing.totalInterestPaid, currencySymbol)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Principal Repaid During Hold</Text>
                <Text style={styles.value}>{fmt(metrics.fixFlipAnalysis.financing.totalPrincipalPaid, currencySymbol)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Remaining Loan Balance at Sale</Text>
                <Text style={styles.value}>{fmt(metrics.fixFlipAnalysis.financing.remainingLoanBalanceAtSale, currencySymbol)}</Text>
              </View>
              <Text style={styles.verdictFootnote}>{metrics.fixFlipAnalysis.modelAssumptions.financingAssumption}</Text>
            </View>

            <View style={styles.flipBox}>
              <Text style={styles.flipBoxTitle}>Break-Even &amp; Equity Return</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Break-Even Sale Price</Text>
                <Text style={styles.value}>
                  {metrics.fixFlipAnalysis.breakEven.breakEvenSalePrice === null
                    ? "N/A"
                    : fmt(metrics.fixFlipAnalysis.breakEven.breakEvenSalePrice, currencySymbol)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Sale-Price Buffer</Text>
                <Text style={styles.value}>
                  {metrics.fixFlipAnalysis.breakEven.salePriceBufferRand === null
                    ? "N/A"
                    : `${fmt(metrics.fixFlipAnalysis.breakEven.salePriceBufferRand, currencySymbol)} (${(metrics.fixFlipAnalysis.breakEven.salePriceBufferPercent ?? 0).toFixed(1)}%)`}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Pre-Tax Equity IRR (annualised)</Text>
                <Text style={styles.value}>
                  {metrics.fixFlipAnalysis.profitability.equityIRR === null
                    ? "N/A"
                    : `${metrics.fixFlipAnalysis.profitability.equityIRR.toFixed(1)}%`}
                </Text>
              </View>
              <Text style={styles.verdictFootnote}>
                The break-even sale price is a mathematical target — the price at which Estimated Profit Before Tax is
                approximately zero — not a prediction of what the property will sell for.
              </Text>
              <Text style={styles.verdictFootnote}>{metrics.fixFlipAnalysis.modelAssumptions.taxAssumption}</Text>
            </View>
          </>
        )}

        {/* Exit-Value Evidence (Phase 4.19) — same fixFlipExitValueAnalysis object the Summary UI reads, no duplicated arithmetic. Evidence and scenarios only — never a verdict. */}
        {isFlip && fixFlipExitValueAnalysis?.status === "available" && (
          <>
            <View style={styles.flipBox}>
              <Text style={styles.flipBoxTitle}>Exit-Value Evidence</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Expected Sale Price (your assumption)</Text>
                <Text style={styles.value}>{fmt(fixFlipExitValueAnalysis.expectedSalePrice, currencySymbol)}</Text>
              </View>
              {fixFlipExitValueAnalysis.evidence.status === "no_numeric_valuation" && (
                <Text style={styles.verdictFootnote}>No numeric property valuation is recorded for comparison.</Text>
              )}
              {fixFlipExitValueAnalysis.evidence.status === "invalid_valuation" && (
                <Text style={styles.verdictFootnote}>
                  The recorded valuation figures are internally inconsistent, so AssetVerdict cannot use them for a comparison.
                </Text>
              )}
              {fixFlipExitValueAnalysis.evidence.estimatedValue !== undefined && (
                <View style={styles.row}>
                  <Text style={styles.label}>Recorded Valuation Estimate</Text>
                  <Text style={styles.value}>{fmt(fixFlipExitValueAnalysis.evidence.estimatedValue, currencySymbol)}</Text>
                </View>
              )}
              {fixFlipExitValueAnalysis.evidence.valueConfidenceLow !== undefined && (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {fixFlipExitValueAnalysis.evidence.valueConfidenceHigh !== undefined ? "Recorded Range" : "Recorded Lower Valuation Bound"}
                  </Text>
                  <Text style={styles.value}>
                    {fixFlipExitValueAnalysis.evidence.valueConfidenceHigh !== undefined
                      ? `${fmt(fixFlipExitValueAnalysis.evidence.valueConfidenceLow, currencySymbol)} – ${fmt(fixFlipExitValueAnalysis.evidence.valueConfidenceHigh, currencySymbol)}`
                      : fmt(fixFlipExitValueAnalysis.evidence.valueConfidenceLow, currencySymbol)}
                  </Text>
                </View>
              )}
              {fixFlipExitValueAnalysis.evidence.rangePosition && (
                <View style={styles.row}>
                  <Text style={styles.label}>Expected Sale Price Position</Text>
                  <Text style={styles.value}>
                    {fixFlipExitValueAnalysis.evidence.rangePosition === "below_range"
                      ? "Below recorded range"
                      : fixFlipExitValueAnalysis.evidence.rangePosition === "above_range"
                      ? "Above recorded range"
                      : "Within recorded range"}
                  </Text>
                </View>
              )}
              {(fixFlipExitValueAnalysis.evidence.reportSource || fixFlipExitValueAnalysis.evidence.reportDate) && (
                <Text style={styles.verdictFootnote}>
                  {fixFlipExitValueAnalysis.evidence.reportSource ?? "Recorded valuation"}
                  {fixFlipExitValueAnalysis.evidence.reportDate
                    ? ` — as of ${new Date(fixFlipExitValueAnalysis.evidence.reportDate).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}`
                    : ""}
                </Text>
              )}
              {(fixFlipExitValueAnalysis.evidence.estimatedValue !== undefined || fixFlipExitValueAnalysis.evidence.valueConfidenceLow !== undefined) &&
                fixFlipExitValueAnalysis.evidence.valuationBasis === "unknown" && (
                  <Text style={styles.verdictFootnote}>
                    Valuation basis not recorded. This valuation does not currently state whether it reflects the property&apos;s current condition
                    or post-renovation condition — AssetVerdict treats it as supporting evidence only, not proof of the eventual post-renovation
                    sale value.
                  </Text>
                )}
            </View>

            {fixFlipExitValueAnalysis.valuationPointCase &&
              renderFlipScenarioBox("Valuation Point Case", fixFlipExitValueAnalysis.valuationPointCase, currencySymbol)}
            {fixFlipExitValueAnalysis.conservativeCase &&
              renderFlipScenarioBox("Conservative Valuation Case", fixFlipExitValueAnalysis.conservativeCase, currencySymbol)}

            <Text style={styles.verdictFootnote}>
              This compares your assumption with recorded evidence and re-runs the same deterministic Fix &amp; Flip model at evidence-backed
              prices — it does not predict what the property will actually sell for, and it is not a Fix &amp; Flip verdict.
            </Text>
          </>
        )}
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
          <Text style={styles.label}>Estimated Tax</Text>
          <Text style={styles.value}>{fmt(metrics.taxMonthly, currencySymbol)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Net Cashflow</Text>
          <Text style={styles.value}>{fmt(metrics.cashflowMonthly, currencySymbol)}</Text>
        </View>
        <Text style={{ fontSize: 8, color: COLORS.slate, marginTop: 4 }}>
          Tax figures are simplified AssetVerdict estimates based on the rates and assumptions
          entered in the deal. They are not tax advice or a calculation of actual tax liability.
        </Text>

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
                <Text style={styles.tableCellSmall}>Cash-on-Cash %</Text>
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
                    <Text style={styles.tableCellSmall}>{p.yearlyROI === null ? "N/A" : `${p.yearlyROI.toFixed(1)}%`}</Text>
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
            {strategyId === "commercial" && (
              <View style={styles.row}>
                <Text style={styles.label}>Remaining Lease Term</Text>
                <Text style={styles.value}>
                  {dealSummary.leaseTermMonths !== null ? `${dealSummary.leaseTermMonths} months` : "Not recorded"}
                </Text>
              </View>
            )}
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

        <Text style={styles.h2}>Furniture, Setup &amp; Renovation Summary</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 8 }}>
          Cost Used in Deal: {fmt(dealSummary.renovationCost, currencySymbol)}
        </Text>
        <Text style={{ fontSize: 8, color: COLORS.slate, marginBottom: 8 }}>
          The amount AssetVerdict includes in Total Investment and return calculations — Quote-or-Budget
          per item, plus contingency. See lib/calculations/furnitureCosts.ts.
        </Text>
        {renovationItems.length === 0 ? (
          <Text style={styles.label}>No furniture/setup/renovation items added.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellSmall}>Category</Text>
              <Text style={styles.tableCellSmall}>Description</Text>
              <Text style={styles.tableCellSmall}>Qty x Unit Cost</Text>
              <Text style={styles.tableCellSmall}>Budgeted</Text>
              <Text style={styles.tableCellSmall}>Quoted</Text>
              <Text style={styles.tableCellSmall}>Cost Used</Text>
              <Text style={styles.tableCellSmall}>Status</Text>
            </View>
            {renovationItems.map((item) => {
              const isContingency = item.category === CONTINGENCY_CATEGORY;
              const result = calcFurnitureItemResult({
                budgeted: item.budgeted,
                quoted: item.quoted ?? null,
                quantity: item.quantity ?? null,
                unitCost: item.unitCost ?? null,
              });
              return (
                <View style={styles.tableRow} key={item.id}>
                  <Text style={styles.tableCellSmall}>{item.category}</Text>
                  <Text style={styles.tableCellSmall}>{item.description}</Text>
                  <Text style={styles.tableCellSmall}>
                    {isContingency
                      ? `${item.unitCost ?? 0}% of Cost Used`
                      : item.quantity != null && item.unitCost != null
                        ? `${item.quantity} x ${fmt(item.unitCost, currencySymbol)}`
                        : ""}
                  </Text>
                  <Text style={styles.tableCellSmall}>{fmt(item.budgeted, currencySymbol)}</Text>
                  <Text style={styles.tableCellSmall}>{isContingency ? "--" : fmt(item.quoted, currencySymbol)}</Text>
                  <Text style={styles.tableCellSmall}>
                    {fmt(isContingency ? item.budgeted : result.costUsed, currencySymbol)}
                  </Text>
                  <Text style={styles.tableCellSmall}>{isContingency ? "--" : item.status}</Text>
                </View>
              );
            })}
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
        {dealSummary.financeSources.length > 0 && (
          <Text style={{ fontSize: 8, color: COLORS.slate, marginTop: 2 }}>
            Repayment shown using AssetVerdict&apos;s standard fully amortising principal-and-interest
            loan model. A source label such as &quot;Bridging&quot; is descriptive only and does not
            change the repayment mathematics — interest-only, bridge, balloon/residual and
            variable-rate structures are not yet modelled.
          </Text>
        )}

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
