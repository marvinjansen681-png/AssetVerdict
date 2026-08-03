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
  annualisedRoi: range(40, 25),
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

/** Gauge colour using the generic (Commercial) threshold table. */
export function getGaugeColor(metric: string, value: number): GaugeColor {
  return getGaugeColorForStrategy(metric, value, "commercial");
}

/** Gauge colour using the threshold table calibrated for the given strategy. */
export function getGaugeColorForStrategy(
  metric: string,
  value: number,
  strategyId: string
): GaugeColor {
  const rule = getStrategyThresholds(strategyId)[metric];
  if (!rule) return "orange";
  // Infinity (e.g. an infinite payback period) and its JSON-over-the-wire
  // form (null, since JSON has no Infinity) both fail this check.
  if (!isFiniteNumber(value)) return "red";
  return rule(value);
}
