/**
 * "Not Applicable" architecture (Phase 1.1, section 12).
 *
 * Several ratios in lib/calculations/index.ts guard against dividing by a
 * zero denominator by returning a plain `0` — a deliberate, low-level
 * protective convention (see e.g. calcCapRatePP, calcGrossYield, calcLTV,
 * calcNetYieldPreTax/PostTax, calcPaybackPeriod). That `0` is NOT a real
 * "0%" or "0 years" — it's a sentinel meaning "this deal doesn't have the
 * information this ratio needs." Changing those low-level functions to
 * return null would ripple through every caller that expects a number
 * (projections, scenario comparisons, PDF math) and risks destabilising the
 * deterministic engine, so this module instead adds a presentation layer
 * that knows, from the deal's inputs, WHEN a `0` actually means N/A — without
 * ever guessing from the output value alone (0 can also be a genuine,
 * correctly-calculated answer for some metrics, e.g. a 0% NOI Margin).
 */
import type { DealInputs, DealMetrics } from "./index";
import { calcInitialEquityInvestment, calcTotalFinanceCostMonthly } from "./index";
import { classifyMetricForStrategy, type MetricClassification } from "./thresholds";

export interface MetricApplicability {
  applicable: boolean;
  /** Plain-English reason, only present when applicable is false. */
  reason?: string;
}

/**
 * The denominators/context an applicability rule might need. Deliberately a
 * loose bag of optional fields (not a full DealInputs) so this can be built
 * from either the full deterministic engine inputs (server/education side)
 * or just the already-calculated DealMetrics the client already has (see
 * applicabilityContextFromMetrics) — the dashboard never needs to see raw
 * DealInputs to know a metric is N/A.
 */
export interface ApplicabilityContext {
  purchasePrice?: number;
  marketValue?: number;
  /** Total Investment less Total Loan Amount — see calcInitialEquityInvestment(). */
  initialEquityInvestment?: number;
  annualDebtService?: number;
  /**
   * The investor's required annual return, as a plain percentage (e.g. 12 =
   * 12%) — DealInputs.discountRate. Not used by any applicability rule
   * itself; carried here so classifyMetricForDeal can forward it straight
   * into classifyMetricForStrategy's target_relative/zero_relative models
   * (Phase 4.1) without every caller building a second context object.
   */
  discountRate?: number;
}

/**
 * `undefined` means "the caller didn't supply this denominator" — treated as
 * no evidence either way, so the metric stays applicable by default. Only an
 * explicitly-supplied non-positive value counts as positive evidence the
 * metric can't be calculated. This keeps every call site that only has a
 * partial context (e.g. the dashboard, which only knows equity, not purchase
 * price) safe by default rather than wrongly flagging metrics it has no
 * opinion on.
 */
function requiresPositive(
  value: number | undefined,
  reason: string
): MetricApplicability {
  if (value === undefined) return { applicable: true };
  return value > 0 ? { applicable: true } : { applicable: false, reason };
}

const APPLICABILITY_RULES: Record<string, (ctx: ApplicabilityContext) => MetricApplicability> = {
  capRatePP: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set"),
  grossYield: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set"),
  ltv: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set"),
  capRateMV: (ctx) => requiresPositive(ctx.marketValue, "No market value set"),
  dscr: (ctx) => requiresPositive(ctx.annualDebtService, "No debt financing is being used"),
  netYieldPreTax: (ctx) =>
    requiresPositive(ctx.initialEquityInvestment, "No positive equity invested (fully or over-financed deal)"),
  netYieldPostTax: (ctx) =>
    requiresPositive(ctx.initialEquityInvestment, "No positive equity invested (fully or over-financed deal)"),
  paybackPeriod: (ctx) =>
    requiresPositive(ctx.initialEquityInvestment, "No positive equity invested (fully or over-financed deal)"),
  irr: (ctx) =>
    requiresPositive(ctx.initialEquityInvestment, "No positive equity invested (fully or over-financed deal)"),
  npv: (ctx) =>
    requiresPositive(ctx.initialEquityInvestment, "No positive equity invested (fully or over-financed deal)"),
};

/**
 * Whether `metricKey` can be meaningfully calculated for a deal, given the
 * denominators it depends on. Metrics with no registered rule are always
 * applicable (most metrics — NOI, revenue, ratios keyed off revenue — don't
 * have a degenerate-input case worth flagging).
 */
export function getMetricApplicability(
  metricKey: string,
  ctx: ApplicabilityContext
): MetricApplicability {
  const rule = APPLICABILITY_RULES[metricKey];
  return rule ? rule(ctx) : { applicable: true };
}

/** Build an ApplicabilityContext from the full deterministic engine inputs (server/education side). */
export function applicabilityContextFromInputs(inputs: DealInputs): ApplicabilityContext {
  return {
    purchasePrice: inputs.purchasePrice,
    marketValue: inputs.marketValue,
    initialEquityInvestment: calcInitialEquityInvestment(inputs),
    annualDebtService: calcTotalFinanceCostMonthly(inputs) * 12,
    discountRate: inputs.discountRate,
  };
}

/**
 * Build an ApplicabilityContext from already-calculated DealMetrics — for
 * callers (the dashboard, the PDF) that only have the API response, not raw
 * DealInputs. depositRequired is numerically identical to
 * calcInitialEquityInvestment() (see that function's doc comment).
 * discountRate is read from npvBreakdown.discountRate (the same value NPV
 * was actually discounted at) rather than requiring a separate prop — it's
 * already on DealMetrics, just nested. purchasePrice/marketValue aren't on
 * DealMetrics, so those two rules can't be evaluated from this context
 * alone — pass a fuller context if needed.
 */
export function applicabilityContextFromMetrics(
  metrics: Pick<DealMetrics, "depositRequired" | "operatingCostsMonthly" | "npvBreakdown">
): ApplicabilityContext {
  return {
    initialEquityInvestment: metrics.depositRequired,
    annualDebtService: metrics.operatingCostsMonthly.finance * 12,
    discountRate: metrics.npvBreakdown?.discountRate,
  };
}

/**
 * The single entry point UI, PDF, and education code should use to go from a
 * calculated value to "what should I show the user": first checks whether
 * the metric is even applicable to this deal (from its denominators), and
 * only if so, defers to classifyMetricForStrategy() for the strategy-aware
 * classified/unclassified judgement. A metric that isn't applicable never
 * receives a colour or a Strong/Caution/Weak label — it's neither good nor
 * bad, it simply doesn't apply. See MetricClassification's three-state
 * union (classified / unclassified / not_applicable) in thresholds.ts —
 * these are deliberately never collapsed into each other.
 */
export function classifyMetricForDeal(
  metricKey: string,
  value: number | null | undefined,
  ctx: ApplicabilityContext,
  strategyId: string
): MetricClassification {
  const applicability = getMetricApplicability(metricKey, ctx);
  if (!applicability.applicable) {
    return {
      status: "not_applicable",
      applicable: false,
      color: null,
      label: null,
      reason: applicability.reason ?? "Not applicable to this deal",
    };
  }
  return classifyMetricForStrategy(metricKey, value, strategyId, {
    discountRate: ctx.discountRate,
    initialEquityInvestment: ctx.initialEquityInvestment,
  });
}
