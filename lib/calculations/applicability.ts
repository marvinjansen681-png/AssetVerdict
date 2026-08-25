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
import { calcInitialEquityInvestment, calcTotalFinanceCostMonthly, calcTotalInvestment } from "./index";
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
  /** Phase 4.23.1 — the RAW, never-defaulted "Estimated Current Market Value" (DealInputs.estimatedMarketValue). Used ONLY by the estimatedValueLtv rule; never confused with `marketValue` above, which silently defaults to purchasePrice. */
  estimatedMarketValue?: number | null;
  /** Phase 4.23.1 — calcTotalInvestment(inputs), for the projectLeverage rule. */
  totalInvestment?: number;
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

/**
 * Phase 4.23.1 — like requiresPositive, but distinguishes "context didn't
 * supply this field" (undefined — stay applicable, deferred to the
 * value-based not_applicable check in classifyMetricForDeal) from
 * "the deal genuinely has no value here" (null — explicitly not
 * applicable). Only estimatedMarketValue uses this: it is a real,
 * deliberately nullable DealInputs field (investor left it blank), not an
 * artifact of a partial ApplicabilityContext.
 */
function requiresExplicitPositive(
  value: number | null | undefined,
  reason: string
): MetricApplicability {
  if (value === undefined) return { applicable: true };
  return value !== null && value > 0 ? { applicable: true } : { applicable: false, reason };
}

const APPLICABILITY_RULES: Record<string, (ctx: ApplicabilityContext) => MetricApplicability> = {
  capRatePP: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set"),
  grossYield: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set"),
  // Deprecated alias — see DealMetrics.ltv's own doc comment. Kept identical
  // to purchaseLtv's rule so any surviving `classifyMetricForDeal("ltv", ...)`
  // call site behaves exactly as before.
  ltv: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set"),
  purchaseLtv: (ctx) => requiresPositive(ctx.purchasePrice, "No purchase price set"),
  estimatedValueLtv: (ctx) =>
    requiresExplicitPositive(ctx.estimatedMarketValue, "No estimated current market value entered"),
  projectLeverage: (ctx) => requiresPositive(ctx.totalInvestment, "No total investment amount available"),
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
    estimatedMarketValue: inputs.estimatedMarketValue,
    totalInvestment: calcTotalInvestment(inputs),
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
 * already on DealMetrics, just nested. purchasePrice/marketValue/
 * estimatedMarketValue aren't on DealMetrics, so those rules can't be
 * evaluated from this context alone — but this is safe by construction:
 * classifyMetricForDeal's own `!isFiniteNumber(value)` check already
 * returns not_applicable whenever the raw metric value itself is null
 * (which purchaseLtv/estimatedValueLtv/projectLeverage always are when
 * their real denominator is missing), so an incomplete context here never
 * lets an N/A metric read as applicable. Pass a fuller context only if a
 * caller needs the applicability *reason text* specifically.
 */
export function applicabilityContextFromMetrics(
  metrics: Pick<DealMetrics, "depositRequired" | "operatingCostsMonthly" | "npvBreakdown" | "totalInvestment">
): ApplicabilityContext {
  return {
    totalInvestment: metrics.totalInvestment,
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
/**
 * Rental income-producing metrics that are structurally meaningless for Fix
 * & Flip (Phase 4.17, sections 65-68): Flip has no ongoing operating income
 * (calcBaseMonthlyRevenue returns 0 for "fix_and_flip"), so NOI-derived
 * ratios like DSCR, Break-Even Ratio, and OER don't measure what they claim
 * to for this strategy, and yield/cap-rate/cash-on-cash concepts assume a
 * holding-period income stream a Flip doesn't have. These are marked
 * not_applicable regardless of their raw computed value — Fix & Flip's own
 * meaningful risk/return concepts (Estimated Profit Before Tax, Pre-Tax
 * Project ROI, Break-Even Sale Price, Sale-Price Buffer) live in
 * lib/calculations/fixFlip.ts instead. Not currently reachable through the
 * Summary UI or Deal Coach (both already strategy-gate to flip-only metric
 * groups — see FLIP_GROUPS in lib/education/metricDefinitions.ts), but this
 * is the correct, defensive fix at the one shared classification entry
 * point so no future caller can accidentally surface a misleading rental
 * classification for a Flip deal.
 */
const FLIP_NOT_APPLICABLE_METRICS = new Set([
  "dscr",
  "breakEvenRatio",
  "operatingExpenseRatio",
  "capRatePP",
  "capRateMV",
  "grossYield",
  "netYieldPreTax",
  "netYieldPostTax",
  "irr",
  "npv",
  "paybackPeriod",
]);

function getFlipApplicabilityOverride(metricKey: string, strategyId: string): MetricApplicability | null {
  if (strategyId !== "fix_and_flip" || !FLIP_NOT_APPLICABLE_METRICS.has(metricKey)) return null;
  return {
    applicable: false,
    reason:
      "This is a rental income-producing metric — Fix & Flip has no ongoing operating income, so it isn't meaningful here. See the Fix & Flip financial model (Estimated Profit Before Tax, Pre-Tax Project ROI, Break-Even Sale Price) instead.",
  };
}

export function classifyMetricForDeal(
  metricKey: string,
  value: number | null | undefined,
  ctx: ApplicabilityContext,
  strategyId: string
): MetricClassification {
  const applicability = getFlipApplicabilityOverride(metricKey, strategyId) ?? getMetricApplicability(metricKey, ctx);
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
