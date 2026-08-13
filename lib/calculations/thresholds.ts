import { isFiniteNumber } from "./index";

export type GaugeColor = "green" | "orange" | "red";

type ThresholdRule = (value: number) => GaugeColor;
type ThresholdSet = Record<string, ThresholdRule>;

const range =
  (greenMin: number, orangeMin: number): ThresholdRule =>
  (v) =>
    v >= greenMin ? "green" : v >= orangeMin ? "orange" : "red";

const inverseRange =
  (greenMax: number, orangeMax: number): ThresholdRule =>
  (v) =>
    v <= greenMax ? "green" : v <= orangeMax ? "orange" : "red";

/** Default (Commercial) threshold reference table — see AssetVerdict_Build_Plan.md section 11. */
const COMMERCIAL_THRESHOLDS: ThresholdSet = {
  irr: (v) => (v > 15 ? "green" : v >= 8 ? "orange" : "red"),
  grossYield: (v) => (v > 10 ? "green" : v >= 7 ? "orange" : "red"),
  netYieldPreTax: (v) => (v > 8 ? "green" : v >= 5 ? "orange" : "red"),
  netYieldPostTax: (v) => (v > 6 ? "green" : v >= 4 ? "orange" : "red"),
  capRateSpread: (v) => (v > 2 ? "green" : v >= 0 ? "orange" : "red"),
  dscr: (v) => (v > 1.25 ? "green" : v >= 1.0 ? "orange" : "red"),
  operatingExpenseRatio: (v) => (v < 40 ? "green" : v <= 60 ? "orange" : "red"),
  utilitiesRatio: (v) => (v < 15 ? "green" : v <= 30 ? "orange" : "red"),
  paybackPeriod: (v) => (v < 8 ? "green" : v <= 12 ? "orange" : "red"),
  ltv: (v) => (v < 60 ? "green" : v <= 75 ? "orange" : "red"),
  breakEvenRatio: (v) => (v < 75 ? "green" : v <= 90 ? "orange" : "red"),
  noiMargin: (v) => (v > 60 ? "green" : v >= 40 ? "orange" : "red"),
  // A cap rate well above the 8-12% sweet spot is flagged red (high risk /
  // overpaying signal), not orange — confirmed against the reference app
  // (13.83% Cap Rate PP renders red there), overriding the build prompt's
  // literal "orange >12%" text.
  capRatePP: (v) => (v >= 8 && v <= 12 ? "green" : v >= 5 && v <= 13 ? "orange" : "red"),
  capRateMV: (v) => (v > 8 ? "green" : v >= 5 ? "orange" : "red"),
};

const BUY_TO_LET_THRESHOLDS: ThresholdSet = {
  ...COMMERCIAL_THRESHOLDS,
  irr: range(12, 8),
  grossYield: range(8, 5),
  dscr: range(1.2, 1.0),
  operatingExpenseRatio: inverseRange(45, 65),
  paybackPeriod: inverseRange(10, 15),
};

const MULTI_LET_THRESHOLDS: ThresholdSet = {
  ...COMMERCIAL_THRESHOLDS,
  irr: range(18, 12),
  grossYield: range(12, 8),
  dscr: range(1.3, 1.0),
  operatingExpenseRatio: inverseRange(50, 70),
  paybackPeriod: inverseRange(7, 10),
};

const STUDENT_THRESHOLDS: ThresholdSet = {
  ...COMMERCIAL_THRESHOLDS,
  irr: range(15, 10),
  grossYield: range(10, 7),
  operatingExpenseRatio: inverseRange(55, 75),
  paybackPeriod: inverseRange(8, 12),
};

const STR_THRESHOLDS: ThresholdSet = {
  ...COMMERCIAL_THRESHOLDS,
  irr: range(20, 12),
  grossYield: range(15, 10),
  operatingExpenseRatio: inverseRange(50, 70),
  paybackPeriod: inverseRange(6, 10),
};

const FIX_AND_FLIP_THRESHOLDS: ThresholdSet = {
  roi: range(25, 15),
  // Phase 3.1 bug fix: this key previously read "annualisedRoi" (lowercase
  // "oi"), which never matched the registry/DealMetrics field name
  // "annualisedROI" used everywhere else (FlipDashboard's GaugeDial,
  // buildDealCoachContext, interpretMetric, metricDefinitions). The lookup
  // silently missed on every real call, so Annualised ROI fell through the
  // "no rule" path — see the classification integrity fix below.
  annualisedROI: range(40, 25),
  netProfit: (v) => (v > 0 ? "green" : "red"),
  holdingPeriod: inverseRange(6, 12),
};

const INSTALMENT_SALE_THRESHOLDS: ThresholdSet = {
  ...COMMERCIAL_THRESHOLDS,
  irr: range(10, 7),
  grossYield: range(8, 5),
  paybackPeriod: inverseRange(12, 20),
};

const STRATEGY_THRESHOLDS: Record<string, ThresholdSet> = {
  commercial: COMMERCIAL_THRESHOLDS,
  buy_to_let: BUY_TO_LET_THRESHOLDS,
  multi_let: MULTI_LET_THRESHOLDS,
  student: STUDENT_THRESHOLDS,
  str: STR_THRESHOLDS,
  fix_and_flip: FIX_AND_FLIP_THRESHOLDS,
  instalment_sale: INSTALMENT_SALE_THRESHOLDS,
};

/** Full threshold set for a given strategy, falling back to Commercial defaults. */
export function getStrategyThresholds(strategyId: string): ThresholdSet {
  return STRATEGY_THRESHOLDS[strategyId] ?? COMMERCIAL_THRESHOLDS;
}

/**
 * Whether AssetVerdict has a calibrated threshold rule for `metric` on this
 * strategy at all — the single source of truth for "does AssetVerdict have
 * an opinion on this metric," used to keep an absent rule from ever
 * masquerading as a real judgement (Phase 3.1).
 */
export function hasCalibratedThreshold(metric: string, strategyId: string): boolean {
  return !!getStrategyThresholds(strategyId)[metric];
}

/**
 * Plain-English judgement label for each gauge colour. This is the ONLY place
 * that maps a colour to a word — the education layer and any future AI coach
 * must call classifyMetricForStrategy() below rather than hard-coding this
 * mapping (or the raw threshold numbers) a second time.
 */
const COLOR_JUDGEMENT_LABEL: Record<GaugeColor, "Strong" | "Caution" | "Weak"> = {
  green: "Strong",
  orange: "Caution",
  red: "Weak",
};

/**
 * Classification integrity (Phase 3.1): a metric's judgement is one of three
 * DISTINCT states, never collapsed into each other —
 *   - "classified":     a calibrated threshold rule exists and produced a
 *                        real green/orange/red judgement.
 *   - "unclassified":   the metric is applicable to this deal, but
 *                        AssetVerdict has no calibrated rule for it (e.g.
 *                        Gross Revenue, Total Investment) — there is no
 *                        Strong/Caution/Weak judgement to give, and this must
 *                        never silently present as "Caution."
 *   - "not_applicable":  the metric doesn't apply to this deal at all (e.g.
 *                        DSCR with no debt) — see applicability.ts.
 * `reason` is optional/undefined on "classified" only so every branch can be
 * read generically as `classification.reason` without narrowing first.
 */
export type MetricClassification =
  | { status: "classified"; applicable: true; color: GaugeColor; label: "Strong" | "Caution" | "Weak"; reason?: string }
  | { status: "unclassified"; applicable: true; color: null; label: null; reason: "no_threshold" }
  | { status: "not_applicable"; applicable: false; color: null; label: null; reason: string };

/**
 * Combines a calculated value with the strategy-aware threshold table to
 * produce a plain-English judgement — WITHOUT exposing or duplicating the
 * underlying threshold numbers. This is what the education layer and Deal
 * Coach should call to say things like "Your DSCR is 1.18x. For this
 * strategy AssetVerdict currently classifies that as Caution," instead of
 * re-encoding "1.25" / "1.0" anywhere outside this file.
 *
 * This is a CLASSIFICATION-FIRST primitive: it looks up whether a calibrated
 * rule exists before producing anything visual. A missing rule is reported as
 * "unclassified," never coerced into a colour — see hasCalibratedThreshold().
 *
 * Non-finite values (e.g. DSCR with no debt, an infinite payback period) are
 * reported "not_applicable" rather than forced into a colour — a deal with
 * no debt at all hasn't "failed" DSCR, the metric simply doesn't apply.
 */
export function classifyMetricForStrategy(
  metric: string,
  value: number | null | undefined,
  strategyId: string
): MetricClassification {
  if (!isFiniteNumber(value)) {
    return {
      status: "not_applicable",
      applicable: false,
      color: null,
      label: null,
      reason: "No finite value is available for this metric",
    };
  }
  const rule = getStrategyThresholds(strategyId)[metric];
  if (!rule) {
    return { status: "unclassified", applicable: true, color: null, label: null, reason: "no_threshold" };
  }
  const color = rule(value);
  return { status: "classified", applicable: true, color, label: COLOR_JUDGEMENT_LABEL[color] };
}

/** Visual colour states a gauge/card can render — "neutral" is a UI treatment for "no calibrated benchmark," never a financial judgement. */
export type GaugeVisualColor = GaugeColor | "neutral";

/**
 * Gauge colour using the generic (Commercial) threshold table — DERIVED from
 * classification, never the reverse (section 6/7 of the Phase 3.1 brief).
 */
export function getGaugeColor(metric: string, value: number): GaugeVisualColor {
  return getGaugeColorForStrategy(metric, value, "commercial");
}

/**
 * Gauge colour using the threshold table calibrated for the given strategy.
 * Returns "neutral" — never "orange" — when no calibrated rule exists for
 * this metric/strategy; callers (GaugeDial, the PDF) must render "neutral"
 * as a neutral/grey state, not amber, since it carries no red/amber/green
 * meaning.
 */
export function getGaugeColorForStrategy(
  metric: string,
  value: number,
  strategyId: string
): GaugeVisualColor {
  const classification = classifyMetricForStrategy(metric, value, strategyId);
  return classification.status === "classified" ? classification.color : "neutral";
}
