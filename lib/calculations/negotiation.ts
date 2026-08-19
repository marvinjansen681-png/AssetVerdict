/**
 * Deterministic Negotiation & Target Purchase Price Engine (Phase 4.15).
 *
 * Answers, deterministically: "what is the highest purchase price at which
 * this deal would satisfy a defined investment condition?" Never guesses —
 * every candidate price is recalculated through the SAME calculation engine
 * (calcAllMetrics) and the SAME verdict engine (deriveDealVerdict) already
 * used everywhere else in AssetVerdict. This module computes nothing new
 * about a deal's financial mechanics; it only searches over `purchasePrice`
 * and re-reads what those two engines already say at each candidate.
 *
 * Architecture:
 *   current DealInputs
 *         v
 *   buildNegotiatedInputs(inputs, candidatePrice)   <- pure, no mutation
 *         v
 *   calcAllMetrics(negotiatedInputs)                <- existing engine
 *         v
 *   deriveDealVerdict(...) / deriveTargetState(...) / checkStructuralSafetyFailure(...)
 *         v
 *   qualifies(candidatePrice): boolean
 *         v
 *   findHighestQualifyingPrice (bounded binary search)
 *         v
 *   NegotiationTargetResult
 *
 * Financing policy (Phase 4.13/4.15 locked default): FIXED ORIGINAL LTV.
 * When purchase price is negotiated down, total finance scales down with it
 * so the loan-to-price RATIO stays constant — the Rand loan amount is never
 * held fixed. Each finance source keeps its own proportional share of total
 * finance, and its own interest rate/term unchanged; only loanAmount scales.
 * A direct, important consequence (see buildNegotiatedInputs's doc comment):
 * LTV% itself does NOT improve when price is negotiated down under this
 * policy — only the absolute Rand amounts (debt, debt service, equity
 * required) do.
 *
 * Everything NOT explicitly a function of purchasePrice under this policy is
 * held fixed: rent, occupancy, operating expenses, market value, renovation
 * cost, transfer/bond cost, growth/tax assumptions, Required Return, sale
 * year. See buildNegotiatedInputs.
 *
 * This module produces NO prose. Every "why" is a stable, structured
 * `reasonCode` plus (where applicable) the engine's own VerdictReason[]
 * blockers — the same pattern verdict.ts uses for VerdictUnavailableReason.
 * Human sentences are assembled downstream in lib/education/negotiationCopy.ts,
 * exactly mirroring how verdictCopy.ts turns verdict.ts's codes into copy.
 *
 * `promising_if_negotiated` and `analyzeNegotiation`/`deriveDealVerdict`
 * (Phase 4.16): `analyzeNegotiation` itself still NEVER produces or
 * references that label anywhere in its own return value — `currentVerdict`
 * and every `resultingVerdict` come straight from the unmodified verdict
 * engine (verdict.ts), which structurally cannot return it (see
 * VERDICT_ENABLED_STRATEGIES/deriveDealVerdict — unchanged by this phase).
 * `promising_if_negotiated` becomes reachable ONLY as the separate, derived
 * `NegotiationOpportunity.status` this module also exports
 * (deriveNegotiationOpportunity, below) — a CONDITIONAL fact about whether a
 * lower price would deterministically reach Strong, never a replacement for,
 * or a claim about, the deal's actual current-asking-price verdict. See that
 * function's doc comment for the exact eligibility rule.
 *
 * Solver domain (Phase 4.15.1): V1's binary search is only validated for
 * original acquisition finance <= 100% of the original purchase price. Above
 * that, negotiation analysis is withheld entirely (all four objectives
 * return `unavailable`/`unsupported_financing_structure`) rather than run an
 * unproven search — see the guard in analyzeNegotiation and the monotonicity
 * note above findHighestQualifyingPrice. This is a restriction on the
 * NEGOTIATION SOLVER only: the deal's own verdict/metrics are computed
 * exactly as before and are unaffected.
 */
import {
  calcAllMetrics,
  calcTotalLoanAmount,
  isFiniteNumber,
  type DealInputs,
  type DealMetrics,
  type FinanceSourceInput,
} from "./index";
import {
  deriveDealVerdict,
  deriveTargetState,
  checkStructuralSafetyFailure,
  VERDICT_ENABLED_STRATEGIES,
  type DealVerdictResult,
  type VerdictReason,
  type VerdictLabel,
} from "./verdict";
import { classifyMetricForDeal, applicabilityContextFromInputs } from "./applicability";

// ---------------------------------------------------------------------------
// Negotiated-input builder (sections 4-16)
// ---------------------------------------------------------------------------

/**
 * Pure. Clones `inputs`, replaces `purchasePrice` with `proposedPurchasePrice`,
 * and scales acquisition finance per the fixed-LTV policy (module doc
 * comment). Every other field — including marketValue, transferBondCost,
 * renovationCost, and every growth/tax/strategy assumption — is copied
 * through UNCHANGED. Never mutates `inputs` or any of its nested arrays.
 *
 * Zero-finance deals (financeSources: []) stay zero-finance at any proposed
 * price — a lower price never manufactures debt that didn't exist (section
 * 8). A deal whose original total finance is 0 (e.g. all sources recorded
 * with a 0 loanAmount) is treated the same way, since there is no original
 * LTV ratio to preserve and no proportional share to compute — this avoids
 * a division by zero, not just avoids an unwanted debt.
 */
export function buildNegotiatedInputs(inputs: DealInputs, proposedPurchasePrice: number): DealInputs {
  const originalPrice = inputs.purchasePrice;
  const originalTotalLoan = calcTotalLoanAmount(inputs);

  let financeSources: FinanceSourceInput[];
  if (inputs.financeSources.length === 0 || !(originalTotalLoan > 0) || !(originalPrice > 0)) {
    financeSources = [];
  } else {
    const originalLTV = originalTotalLoan / originalPrice;
    const newTotalLoan = originalLTV * proposedPurchasePrice;
    financeSources = inputs.financeSources.map((f) => {
      const share = f.loanAmount / originalTotalLoan;
      return { ...f, loanAmount: newTotalLoan * share };
    });
  }

  return { ...inputs, purchasePrice: proposedPurchasePrice, financeSources };
}

// ---------------------------------------------------------------------------
// Objectives & output model (section 17, 27)
// ---------------------------------------------------------------------------

export type NegotiationObjective =
  | "meet_required_return"
  | "clear_structural_safety"
  | "reach_promising"
  | "reach_strong";

/**
 * Stable, deterministic reason codes (section 36) — never AI prose. The
 * education layer (lib/education/negotiationCopy.ts) is the only place that
 * turns these into sentences.
 */
export type NegotiationReasonCode =
  | "already_meets_target"
  | "target_return_requires_lower_price"
  | "structural_safety_requires_lower_price"
  | "strong_requires_lower_price"
  | "promising_requires_lower_price"
  | "target_return_not_achievable_by_price"
  | "structural_safety_not_achievable_by_price"
  | "strong_not_achievable_by_price"
  | "promising_not_achievable_by_price";

export type NegotiationUnavailableReason =
  | "strategy_not_supported"
  | "invalid_purchase_price"
  | "insufficient_inputs"
  | "unsupported_financing_structure";

export interface NegotiationAlreadyMeets {
  status: "already_meets";
  objective: NegotiationObjective;
  currentPrice: number;
  targetPrice: number;
  reductionRand: 0;
  reductionPercent: 0;
  reasonCode: "already_meets_target";
  resultingVerdict?: DealVerdictResult;
}

export interface NegotiationSolvable {
  status: "solvable";
  objective: NegotiationObjective;
  currentPrice: number;
  /** The HIGHEST price satisfying the objective (section 37) — never a lower, also-qualifying price. */
  targetPrice: number;
  reductionRand: number;
  reductionPercent: number;
  reasonCode: NegotiationReasonCode;
  resultingMetrics: DealMetrics;
  resultingVerdict?: DealVerdictResult;
}

export interface NegotiationNotAchievable {
  status: "not_achievable_by_price";
  objective: NegotiationObjective;
  currentPrice: number;
  reasonCode: NegotiationReasonCode;
  /** The engine's own structured reasons at the lowest price tested — never re-derived prose. */
  blockers: VerdictReason[];
}

export interface NegotiationUnavailable {
  status: "unavailable";
  objective: NegotiationObjective;
  reason: NegotiationUnavailableReason;
}

export type NegotiationTargetResult =
  | NegotiationAlreadyMeets
  | NegotiationSolvable
  | NegotiationNotAchievable
  | NegotiationUnavailable;

// ---------------------------------------------------------------------------
// Numeric solver (sections 21-24, 37-42)
//
// Domain is strictly 0 < candidatePrice <= currentPrice (section 21) — this
// solver only ever asks "how much lower," never searches above asking price.
// Monotonicity (section 22-23, hardened Phase 4.15.1): under the fixed-LTV
// policy, every objective predicate is expected to be non-decreasing as
// price falls (true at low price, false at high price, at most one
// crossing) — lower price scales finance down proportionally, which lowers
// debt service and raises DSCR/lowers Break-Even Ratio/raises IRR, while
// every non-price input is held fixed (section 10). This is verified
// empirically for representative fixtures in negotiation.test.ts
// (multi-source, debt-free, high-LTV, OER-weak cases) — an empirical
// spot-check across the validated domain, not a universal mathematical
// proof. V1 deliberately limits the solver to the financing domain for
// which this behaviour has been validated: original acquisition finance
// <= 100% of the original purchase price. Inputs above that ratio never
// reach this binary search at all — analyzeNegotiation's guard withholds
// all four objectives before any evaluate() call runs, so the previously
// unproven >100%-LTV case can no longer enter here.
// ---------------------------------------------------------------------------

const PRICE_TOLERANCE = 1; // R1 (section 24)
const MAX_ITERATIONS = 60; // 2^60 range collapse is far more than enough for any realistic Rand range

/**
 * Finds the highest price in (0, currentPrice] at which `qualifies` is true,
 * assuming `qualifies` is true for low prices and false for high prices with
 * at most one crossing. Returns null if `qualifies` is false even at the
 * lowest price tested (R1, or currentPrice itself if currentPrice < R1) —
 * the caller has already confirmed `qualifies(currentPrice)` is false before
 * calling this, per solveObjective below.
 */
function findHighestQualifyingPrice(currentPrice: number, qualifies: (price: number) => boolean): number | null {
  const floor = Math.min(PRICE_TOLERANCE, currentPrice);
  if (!qualifies(floor)) return null;

  let lo = floor; // qualifies(lo) === true
  let hi = currentPrice; // qualifies(hi) === false (guaranteed by caller)
  let iterations = 0;
  while (hi - lo > PRICE_TOLERANCE && iterations < MAX_ITERATIONS) {
    const mid = (lo + hi) / 2;
    if (qualifies(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }
  return lo;
}

interface ObjectiveEvaluation {
  qualifies: boolean;
  metrics: DealMetrics;
  verdict?: DealVerdictResult;
  /** Only meaningful when !qualifies — the engine's own structured reasons. */
  blockers: VerdictReason[];
}

function solveObjective(params: {
  objective: NegotiationObjective;
  currentPrice: number;
  evaluate: (price: number) => ObjectiveEvaluation;
  solvableReasonCode: NegotiationReasonCode;
  notAchievableReasonCode: NegotiationReasonCode;
}): NegotiationTargetResult {
  const { objective, currentPrice, evaluate, solvableReasonCode, notAchievableReasonCode } = params;

  const atCurrent = evaluate(currentPrice);
  if (atCurrent.qualifies) {
    return {
      status: "already_meets",
      objective,
      currentPrice,
      targetPrice: currentPrice,
      reductionRand: 0,
      reductionPercent: 0,
      reasonCode: "already_meets_target",
      resultingVerdict: atCurrent.verdict,
    };
  }

  const targetPrice = findHighestQualifyingPrice(currentPrice, (price) => evaluate(price).qualifies);
  if (targetPrice === null) {
    const floor = Math.min(PRICE_TOLERANCE, currentPrice);
    const atFloor = evaluate(floor);
    return {
      status: "not_achievable_by_price",
      objective,
      currentPrice,
      reasonCode: notAchievableReasonCode,
      blockers: atFloor.blockers,
    };
  }

  const atTarget = evaluate(targetPrice);
  const reductionRand = currentPrice - targetPrice;
  return {
    status: "solvable",
    objective,
    currentPrice,
    targetPrice,
    reductionRand,
    reductionPercent: currentPrice > 0 ? (reductionRand / currentPrice) * 100 : 0,
    reasonCode: solvableReasonCode,
    resultingMetrics: atTarget.metrics,
    resultingVerdict: atTarget.verdict,
  };
}

// ---------------------------------------------------------------------------
// Per-objective evaluators — each reuses the ONE existing engine (section 16,
// 51): calcAllMetrics for metrics, and deriveDealVerdict / deriveTargetState /
// checkStructuralSafetyFailure (verdict.ts, unmodified) for judgement. No
// DSCR/IRR/NPV/verdict rule is reimplemented here.
// ---------------------------------------------------------------------------

function evaluateRequiredReturn(inputs: DealInputs, strategyId: string, price: number): ObjectiveEvaluation {
  const negotiated = buildNegotiatedInputs(inputs, price);
  const metrics = calcAllMetrics(negotiated);
  const applicabilityCtx = applicabilityContextFromInputs(negotiated);
  const irrClassification = classifyMetricForDeal("irr", metrics.irr, applicabilityCtx, strategyId);
  const { state, reasons } = deriveTargetState({
    irrClassification,
    irr: metrics.irr,
    discountRate: negotiated.discountRate,
  });
  const verdict = deriveDealVerdict({ strategyId, inputs: negotiated, metrics });
  return { qualifies: state === "met", metrics, verdict, blockers: reasons };
}

function evaluateStructuralSafety(inputs: DealInputs, strategyId: string, price: number): ObjectiveEvaluation {
  const negotiated = buildNegotiatedInputs(inputs, price);
  const metrics = calcAllMetrics(negotiated);
  const hasDebt = isFiniteNumber(metrics.annualDebtService) && metrics.annualDebtService > 0;
  const structural = checkStructuralSafetyFailure({
    dscr: metrics.dscr,
    hasDebt,
    breakEvenRatio: metrics.breakEvenRatio,
    cashflowAnnualPreTax: metrics.cashflowAnnualPreTax,
  });
  const verdict = deriveDealVerdict({ strategyId, inputs: negotiated, metrics });
  return {
    qualifies: !structural.failed,
    metrics,
    verdict,
    blockers: structural.reasons.filter((r) => r.severity === "blocking"),
  };
}

function evaluateVerdictLabel(
  inputs: DealInputs,
  strategyId: string,
  price: number,
  qualifyingLabels: ReadonlySet<string>
): ObjectiveEvaluation {
  const negotiated = buildNegotiatedInputs(inputs, price);
  const metrics = calcAllMetrics(negotiated);
  const verdict = deriveDealVerdict({ strategyId, inputs: negotiated, metrics });
  const qualifies = verdict.status === "available" && qualifyingLabels.has(verdict.verdict);
  const blockers = verdict.status === "available" ? verdict.blockers : [];
  return { qualifies, metrics, verdict, blockers };
}

const STRONG_LABELS = new Set(["strong"]);
const PROMISING_OR_BETTER_LABELS = new Set(["strong", "promising"]);

// ---------------------------------------------------------------------------
// Main entry point (section 28, 53)
// ---------------------------------------------------------------------------

export const NEGOTIATION_MODEL_VERSION = "4.15";

export interface NegotiationModelAssumptions {
  financingPolicy: "fixed_original_ltv";
  negotiationModelVersion: string;
  /** section 60 education hook: fields explicitly held constant while price is negotiated. */
  heldConstant: string[];
}

/**
 * Always the same shape (section 28) — callers never branch on a top-level
 * "available"/"unavailable" status; each of the four objectives carries its
 * own status individually (all four become `{status: "unavailable", ...}`
 * together when the strategy isn't verdict-ready or the purchase price is
 * invalid — see the guards at the top of analyzeNegotiation). `currentVerdict`
 * is always attempted via the existing verdict engine, which already has its
 * own well-defined behaviour for unsupported strategies (VerdictUnavailable)
 * and degenerate inputs.
 */
export interface NegotiationAnalysis {
  currentPrice: number;
  currentVerdict: DealVerdictResult;
  meetRequiredReturn: NegotiationTargetResult;
  clearStructuralSafety: NegotiationTargetResult;
  reachPromising: NegotiationTargetResult;
  reachStrong: NegotiationTargetResult;
  modelAssumptions: NegotiationModelAssumptions;
}

const HELD_CONSTANT_FIELDS = [
  "monthlyRent/nightlyRate/room rents",
  "occupancyRate",
  "operating expenses (utilities, rates, insurance, management, maintenance)",
  "marketValue",
  "transferBondCost",
  "renovationCost",
  "capitalGrowthRate / rentalGrowthRate / costInflation",
  "discountRate (Required Return)",
  "saleYear / wantToSell",
  "incomeTaxRate / capitalGainsTaxRate",
];

function unavailableAllObjectives(reason: NegotiationUnavailableReason): {
  meetRequiredReturn: NegotiationUnavailable;
  clearStructuralSafety: NegotiationUnavailable;
  reachPromising: NegotiationUnavailable;
  reachStrong: NegotiationUnavailable;
} {
  const mk = (objective: NegotiationObjective): NegotiationUnavailable => ({ status: "unavailable", objective, reason });
  return {
    meetRequiredReturn: mk("meet_required_return"),
    clearStructuralSafety: mk("clear_structural_safety"),
    reachPromising: mk("reach_promising"),
    reachStrong: mk("reach_strong"),
  };
}

const BASE_MODEL_ASSUMPTIONS: NegotiationModelAssumptions = {
  financingPolicy: "fixed_original_ltv",
  negotiationModelVersion: NEGOTIATION_MODEL_VERSION,
  heldConstant: HELD_CONSTANT_FIELDS,
};

/**
 * Pure, deterministic, server-authoritative (section 53, 88 architecture
 * diagram). Reads only `inputs` (already server-recomputed DealInputs, e.g.
 * from assembleInputs()) and never trusts a client-supplied price, verdict,
 * or reduction. Never mutates `inputs`.
 */
export function analyzeNegotiation(inputs: DealInputs, strategyId: string): NegotiationAnalysis {
  const currentPrice = inputs.purchasePrice;
  const currentMetrics = calcAllMetrics(inputs);
  const currentVerdict = deriveDealVerdict({ strategyId, inputs, metrics: currentMetrics });

  // ---- Strategy eligibility (section 20) --------------------------------
  if (!VERDICT_ENABLED_STRATEGIES.has(strategyId)) {
    return { currentPrice, currentVerdict, ...unavailableAllObjectives("strategy_not_supported"), modelAssumptions: BASE_MODEL_ASSUMPTIONS };
  }

  // ---- Guard: zero/invalid purchase price (section 9) -------------------
  if (!isFiniteNumber(currentPrice) || currentPrice <= 0) {
    return { currentPrice, currentVerdict, ...unavailableAllObjectives("invalid_purchase_price"), modelAssumptions: BASE_MODEL_ASSUMPTIONS };
  }

  // ---- Guard: original acquisition finance > purchase price (Phase 4.15.1)
  // The fixed-LTV search domain has only been validated for original LTV
  // <= 100% (see negotiation.test.ts's monotonicity spot-checks). Above
  // that, the solver's monotonicity assumption is unproven, so V1
  // deliberately withholds ALL FOUR objectives rather than run an unproven
  // binary search. Uses raw total loan vs. raw price — never the rounded
  // `metrics.ltv` percentage — and sums across every finance source, so a
  // combined over-financing case (no single source individually > price)
  // is still caught. Exactly 100% (originalTotalLoan === currentPrice)
  // remains supported — only strictly-greater-than is blocked. This does
  // NOT touch the deal's own verdict/metrics in any way; only negotiation
  // analysis is withheld.
  const originalTotalLoan = calcTotalLoanAmount(inputs);
  if (originalTotalLoan > currentPrice) {
    return {
      currentPrice,
      currentVerdict,
      ...unavailableAllObjectives("unsupported_financing_structure"),
      modelAssumptions: BASE_MODEL_ASSUMPTIONS,
    };
  }

  const meetRequiredReturn = solveObjective({
    objective: "meet_required_return",
    currentPrice,
    evaluate: (price) => evaluateRequiredReturn(inputs, strategyId, price),
    solvableReasonCode: "target_return_requires_lower_price",
    notAchievableReasonCode: "target_return_not_achievable_by_price",
  });

  const clearStructuralSafety = solveObjective({
    objective: "clear_structural_safety",
    currentPrice,
    evaluate: (price) => evaluateStructuralSafety(inputs, strategyId, price),
    solvableReasonCode: "structural_safety_requires_lower_price",
    notAchievableReasonCode: "structural_safety_not_achievable_by_price",
  });

  const reachPromising = solveObjective({
    objective: "reach_promising",
    currentPrice,
    evaluate: (price) => evaluateVerdictLabel(inputs, strategyId, price, PROMISING_OR_BETTER_LABELS),
    solvableReasonCode: "promising_requires_lower_price",
    notAchievableReasonCode: "promising_not_achievable_by_price",
  });

  const reachStrong = solveObjective({
    objective: "reach_strong",
    currentPrice,
    evaluate: (price) => evaluateVerdictLabel(inputs, strategyId, price, STRONG_LABELS),
    solvableReasonCode: "strong_requires_lower_price",
    notAchievableReasonCode: "strong_not_achievable_by_price",
  });

  return {
    currentPrice,
    currentVerdict,
    meetRequiredReturn,
    clearStructuralSafety,
    reachPromising,
    reachStrong,
    modelAssumptions: BASE_MODEL_ASSUMPTIONS,
  };
}

// ---------------------------------------------------------------------------
// Conditional Negotiation Opportunity (Phase 4.16)
//
// Answers a SEPARATE question from analyzeNegotiation: "does deterministic
// evidence justify a conditional 'this deal could become Strong through
// price alone' status?" This is the Model C / dual-state design (Phase 4.16
// section 5): the deal's own CURRENT-asking-price `verdict` is never
// replaced or softened by this — it is read, never written, by the function
// below. `promising_if_negotiated` here is a status on a DIFFERENT,
// deliberately separate type (NegotiationOpportunity), never a value
// deriveDealVerdict or analyzeNegotiation's own `currentVerdict`/
// `resultingVerdict` fields can produce (see the module doc comment above).
//
// This function calls NO financial formula and duplicates NO solver — it
// only reads fields `deriveDealVerdict` and `analyzeNegotiation` (specifically
// `reachStrong`) already computed. See its doc comment for the exact,
// deliberately strict eligibility rule (Phase 4.16 section 8).
// ---------------------------------------------------------------------------

export type NegotiationOpportunityReasonCode =
  | "strong_reachable_by_price"
  | "already_strong"
  | "current_high_risk"
  | "strong_not_reachable_by_price"
  | "target_price_not_lower"
  | "resulting_verdict_not_strong";

export type NegotiationOpportunityUnavailableReason = NegotiationUnavailableReason | "current_verdict_unavailable";

/**
 * The deal's current asking price CANNOT deterministically reach Strong
 * through purchase price alone, and no lower price is needed either — every
 * strict condition in section 8 held. `currentVerdictLabel` is included
 * purely for display context (never re-derived, never re-judged here); it
 * is always "does_not_meet_target" or "promising" in practice, since
 * "strong" and "high_risk" are excluded before this branch is reachable.
 */
export interface NegotiationOpportunityPromising {
  status: "promising_if_negotiated";
  reasonCode: "strong_reachable_by_price";
  currentVerdictLabel: VerdictLabel;
  /** Reused EXACTLY from negotiationAnalysis.reachStrong — never recalculated or independently rounded (section 46). */
  targetPrice: number;
  reductionRand: number;
  reductionPercent: number;
  resultingVerdict: "strong";
}

/** Deterministically NOT eligible for the conditional label — `reasonCode` says why; `blockers` carries the engine's own reasons when relevant (never re-derived prose). */
export interface NegotiationOpportunityNone {
  status: "no_negotiation_opportunity";
  reasonCode: Exclude<NegotiationOpportunityReasonCode, "strong_reachable_by_price" | "already_strong">;
  blockers?: VerdictReason[];
}

/** The deal already clears Strong at its current asking price — no conditional rescue is needed (section 10, 23). */
export interface NegotiationOpportunityAlreadyStrong {
  status: "already_strong";
}

export interface NegotiationOpportunityUnavailable {
  status: "unavailable";
  reason: NegotiationOpportunityUnavailableReason;
}

export type NegotiationOpportunity =
  | NegotiationOpportunityPromising
  | NegotiationOpportunityNone
  | NegotiationOpportunityAlreadyStrong
  | NegotiationOpportunityUnavailable;

/**
 * Pure. Consumes only already-computed `currentVerdict` (deriveDealVerdict's
 * own output) and `negotiationAnalysis` (analyzeNegotiation's own output) —
 * never touches DealInputs, never calls calcAllMetrics/buildNegotiatedInputs,
 * never re-runs the solver. Reading order mirrors the strict definition in
 * Phase 4.16 section 8 exactly, evaluated top-to-bottom as a precedence
 * chain — availability is a PREREQUISITE gate (section 8 points 1-2) decided
 * before the current-verdict exclusions (points 3-4), which in turn are
 * decided before price eligibility is even considered (section 9-10
 * mandate):
 *
 *   1. currentVerdict not "available"            -> unavailable (a
 *      strategy-unsupported/insufficient-evidence deal has no current label
 *      to compare a conditional status against at all)
 *   2. negotiationAnalysis.reachStrong === "unavailable" -> unavailable, same
 *      reason (e.g. unsupported_financing_structure, invalid_purchase_price
 *      — section 43). Checked BEFORE the high_risk/strong exclusions below:
 *      a deal can be structurally high_risk AND have unavailable negotiation
 *      (e.g. >100% LTV) at the same time, and "negotiation is technically
 *      unavailable" is the more specific, more useful fact to surface.
 *   3. currentVerdict.verdict === "strong"        -> already_strong (never
 *      "promising_if_negotiated" — there is nothing to rescue)
 *   4. currentVerdict.verdict === "high_risk"     -> no_negotiation_opportunity
 *      / current_high_risk, REGARDLESS of what reachStrong says (a
 *      structural safety failure at the CURRENT price is never softened by
 *      a hopeful conditional headline — section 9, mandatory)
 *   5. negotiationAnalysis.reachStrong read for the two remaining current
 *      verdicts ("does_not_meet_target" and "promising", sections 11-12,
 *      treated identically):
 *        - "already_meets"        -> already_strong (defensive: this would
 *          mean Strong already holds at the current price, which the
 *          currentVerdict==="strong" branch above should already have
 *          caught — kept as a safe fallback, never surfaced as a
 *          contradiction)
 *        - "not_achievable_by_price" -> no_negotiation_opportunity /
 *          strong_not_reachable_by_price, blockers reused verbatim (covers
 *          Weak OER section 13, preserved high LTV section 14, and
 *          unresolved "unknown" evidence section 25 — no special-casing
 *          needed, since all of these already surface as
 *          not_achievable_by_price from the existing engine)
 *        - "solvable"             -> defensively re-verified against
 *          section 8 points 6-7 (resultingVerdict really is "strong";
 *          targetPrice really is < currentPrice) before being accepted as
 *          "promising_if_negotiated" — both checks are structural
 *          invariants of solveObjective/evaluateVerdictLabel and should
 *          never fail in practice; if they somehow did, this falls back to
 *          a "no_negotiation_opportunity" reason naming exactly which
 *          invariant didn't hold, rather than silently trusting it.
 */
export function deriveNegotiationOpportunity(
  currentVerdict: DealVerdictResult,
  negotiationAnalysis: NegotiationAnalysis
): NegotiationOpportunity {
  if (currentVerdict.status !== "available") {
    return { status: "unavailable", reason: "current_verdict_unavailable" };
  }

  const { reachStrong } = negotiationAnalysis;

  if (reachStrong.status === "unavailable") {
    return { status: "unavailable", reason: reachStrong.reason };
  }

  if (currentVerdict.verdict === "strong") {
    return { status: "already_strong" };
  }

  if (currentVerdict.verdict === "high_risk") {
    return { status: "no_negotiation_opportunity", reasonCode: "current_high_risk" };
  }

  if (reachStrong.status === "already_meets") {
    return { status: "already_strong" };
  }

  if (reachStrong.status === "not_achievable_by_price") {
    return { status: "no_negotiation_opportunity", reasonCode: "strong_not_reachable_by_price", blockers: reachStrong.blockers };
  }

  // reachStrong.status === "solvable" from here.
  if (!(reachStrong.resultingVerdict?.status === "available" && reachStrong.resultingVerdict.verdict === "strong")) {
    return { status: "no_negotiation_opportunity", reasonCode: "resulting_verdict_not_strong" };
  }
  if (!(reachStrong.targetPrice < reachStrong.currentPrice)) {
    return { status: "no_negotiation_opportunity", reasonCode: "target_price_not_lower" };
  }

  return {
    status: "promising_if_negotiated",
    reasonCode: "strong_reachable_by_price",
    currentVerdictLabel: currentVerdict.verdict,
    targetPrice: reachStrong.targetPrice,
    reductionRand: reachStrong.reductionRand,
    reductionPercent: reachStrong.reductionPercent,
    resultingVerdict: "strong",
  };
}
