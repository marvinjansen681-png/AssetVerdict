export type GaugeColor = "green" | "orange" | "red";

type ThresholdRule = (value: number) => GaugeColor;

/** Threshold reference table — see AssetVerdict_Build_Plan.md section 11. */
const THRESHOLDS: Record<string, ThresholdRule> = {
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

export function getGaugeColor(metric: keyof typeof THRESHOLDS | string, value: number): GaugeColor {
  const rule = THRESHOLDS[metric];
  if (!rule) return "orange";
  if (!isFinite(value)) return value > 0 ? "green" : "red";
  return rule(value);
}
