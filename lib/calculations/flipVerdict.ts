/**
 * Deterministic Fix & Flip Verdict Engine (Phase 4.20).
 *
 * Fix & Flip's decision tree is deliberately NOT the rental engine's
 * DSCR/Break-Even/OER/IRR machinery force-fit onto different numbers — it
 * is its own, much simpler chain, built entirely from evidence Phases
 * 4.17-4.19.1 already locked down:
 *
 *   Base Estimated Profit Before Tax <= 0
 *     -> High Risk (structural, overrides everything else)
 *   Base Equity IRR unknown
 *     -> verdict unavailable (never guessed as a target miss)
 *   Base Equity IRR < Required Return
 *     -> Does Not Meet Target
 *   Base viable + target met, but insufficient post-renovation downside
 *   evidence (no numeric valuation / invalid / basis unknown / basis
 *   current-condition / no lower bound / lower bound doesn't survive)
 *     -> Promising, with the SPECIFIC blocking reason named
 *   Base viable + target met + a valid post-renovation Conservative
 *   Valuation Case that remains profitable
 *     -> Strong
 *
 * No universal Sale-Price Buffer threshold, Project ROI threshold, Rand
 * profit band, or 70% rule appears anywhere in this file — see
 * AssetVerdict_Phase4.18_FixFlip_Verdict_Evidence_Calibration_Audit.md for
 * why each was rejected. The only two numeric comparisons this module makes
 * are `estimatedProfitBeforeTax <= 0` (a definitional structural fact, not
 * a calibrated threshold) and `equityIRR >= discountRate` (the investor's
 * own number, mirroring the rental engine's identical rule).
 *
 * Policy A ("profit survival"), not Policy B ("full target survival"): the
 * Conservative Valuation Case must remain PROFITABLE to support Strong, but
 * its own Equity IRR is NOT required to still clear the Required Return.
 * Stress-tested in the Phase 4.20 report against three counterexamples
 * before being locked — see "L. Policy A vs Policy B analysis" there. The
 * Conservative Case's own target result is still surfaced as a supporting,
 * non-blocking reason either way (never hidden), and Strong's reasons
 * always include the exact Conservative profit Rand amount so a thin
 * margin is visible on its face rather than silently passing a hidden gate.
 *
 * This module computes NOTHING financial itself — every number it reads
 * came from calcFixFlipAnalysis (via metrics.fixFlipAnalysis) or
 * calcFlipExitValueAnalysis (via the caller-supplied
 * `flipExitValueAnalysis`, computed once by the API route and never
 * recomputed here). Pure function, no I/O, no AI, no randomness.
 */
import type { DealInputs, DealMetrics } from "./index";
import { isFiniteNumber } from "./index";
import type { FlipExitValueAnalysis, FlipExitValueAnalysisAvailable } from "./fixFlipExitValue";
import { unavailable, available, type DealVerdictResult, type VerdictReason } from "./verdict";

/** Distinct from the rental engine's VERDICT_MODEL_VERSION ("4.14") — this is a different engine with its own rule set (verdict.ts's available()/unavailable() helpers stamp whichever version they're given). */
export const FLIP_VERDICT_MODEL_VERSION = "4.20";

export interface DeriveFlipVerdictParams {
  inputs: DealInputs;
  metrics: DealMetrics;
  flipExitValueAnalysis?: FlipExitValueAnalysis;
}

/**
 * Structured, stable reason codes naming exactly why Strong wasn't reached
 * (section 26, mandatory — Promising must never degrade into a generic
 * "some risks remain"). Each is mutually exclusive with the others; exactly
 * one fires per Promising verdict, in evidence-completeness order.
 */
type FlipStrongBlockerCode =
  | "no_exit_value_evidence"
  | "invalid_valuation_evidence"
  | "valuation_basis_unknown"
  | "valuation_current_condition"
  | "no_conservative_lower_bound"
  | "conservative_case_not_profitable";

function evaluateStrongEvidence(
  flipExitValueAnalysis: FlipExitValueAnalysis | undefined
): { cleared: true; conservative: NonNullable<FlipExitValueAnalysisAvailable["conservativeCase"]> } | { cleared: false; blocker: FlipStrongBlockerCode } {
  if (!flipExitValueAnalysis || flipExitValueAnalysis.status !== "available") {
    return { cleared: false, blocker: "no_exit_value_evidence" };
  }
  const { evidence, conservativeCase } = flipExitValueAnalysis;

  if (evidence.status === "no_numeric_valuation") return { cleared: false, blocker: "no_exit_value_evidence" };
  if (evidence.status === "invalid_valuation") return { cleared: false, blocker: "invalid_valuation_evidence" };
  if (evidence.valuationBasis === "unknown") return { cleared: false, blocker: "valuation_basis_unknown" };
  if (evidence.valuationBasis === "current_condition") return { cleared: false, blocker: "valuation_current_condition" };
  if (!conservativeCase) return { cleared: false, blocker: "no_conservative_lower_bound" };
  // Strict > 0 (section 76, mandatory) — exactly zero does NOT survive.
  if (!conservativeCase.survivesConservativeCase) return { cleared: false, blocker: "conservative_case_not_profitable" };

  return { cleared: true, conservative: conservativeCase };
}

const STRONG_BLOCKER_REASON: Record<FlipStrongBlockerCode, (params: { discountRate: number }) => VerdictReason> = {
  no_exit_value_evidence: () => ({
    code: "no_exit_value_evidence",
    category: "target",
    severity: "moderate",
  }),
  invalid_valuation_evidence: () => ({
    code: "invalid_valuation_evidence",
    category: "target",
    severity: "moderate",
  }),
  valuation_basis_unknown: () => ({
    code: "valuation_basis_unknown",
    category: "target",
    severity: "moderate",
  }),
  valuation_current_condition: () => ({
    code: "valuation_current_condition",
    category: "target",
    severity: "moderate",
  }),
  no_conservative_lower_bound: () => ({
    code: "no_conservative_lower_bound",
    category: "target",
    severity: "moderate",
  }),
  conservative_case_not_profitable: () => ({
    code: "conservative_case_not_profitable",
    category: "target",
    severity: "high",
  }),
};

/**
 * Supporting-only reason (never blocking either way under Policy A) noting
 * whether the Conservative Valuation Case's own Equity IRR still clears
 * Required Return — kept visible, never hidden, per section 50-51.
 */
function buildConservativeTargetSupportingReason(
  conservative: NonNullable<FlipExitValueAnalysisAvailable["conservativeCase"]>
): VerdictReason {
  if (conservative.meetsRequiredReturnInConservativeCase === true) {
    return {
      code: "conservative_target_met",
      category: "target",
      severity: "informational",
      metric: "equityIRR",
      value: conservative.summary.equityIRR,
    };
  }
  if (conservative.meetsRequiredReturnInConservativeCase === false) {
    return {
      code: "conservative_target_missed",
      category: "target",
      severity: "informational",
      metric: "equityIRR",
      value: conservative.summary.equityIRR,
    };
  }
  return { code: "conservative_target_unknown", category: "target", severity: "informational" };
}

export function deriveFlipVerdict(params: DeriveFlipVerdictParams): DealVerdictResult {
  const { inputs, metrics, flipExitValueAnalysis } = params;

  // ---- Step 1: Fix & Flip financial model unavailable (e.g. invalid
  // holding period) -> verdict unavailable, never a fake structural loss.
  const flip = metrics.fixFlipAnalysis;
  if (!flip || flip.status !== "available") {
    return unavailable(
      "flip_model_unavailable",
      [{ code: "flip_model_unavailable", category: "availability", severity: "informational" }],
      FLIP_VERDICT_MODEL_VERSION
    );
  }

  const { profitability } = flip;
  const profit = profitability.estimatedProfitBeforeTax;
  const buffer = flip.breakEven.salePriceBufferPercent;

  // ---- Step 2: structural High Risk (section 21-22, 57) — Base Profit <=0
  // overrides everything else: a large IRR, a post-renovation valuation, a
  // profitable Conservative Case, none of it can soften a currently-losing
  // Base case. Evaluated BEFORE target, exactly like rental's own
  // structural-safety-first precedent.
  if (profit <= 0) {
    return available(
      "high_risk",
      { viability: "loss", target: "unknown", exitEvidence: "unavailable" },
      [
        { code: "flip_structural_loss", category: "safety", severity: "blocking", metric: "estimatedProfitBeforeTax", value: profit },
        ...(buffer !== null ? [{ code: "flip_sale_price_buffer_context", category: "performance" as const, severity: "informational" as const, metric: "salePriceBufferPercent", value: buffer }] : []),
      ],
      [{ code: "flip_structural_loss", category: "safety", severity: "blocking", metric: "estimatedProfitBeforeTax", value: profit }],
      FLIP_VERDICT_MODEL_VERSION
    );
  }

  // ---- Step 3: target unknown -> verdict unavailable (section 24, 103) —
  // never silently treated as a missed target.
  const equityIRR = profitability.equityIRR;
  const discountRate = inputs.discountRate;
  if (equityIRR === null || !isFiniteNumber(equityIRR) || !isFiniteNumber(discountRate)) {
    return unavailable(
      "flip_return_evidence_unavailable",
      [{ code: "flip_return_evidence_unavailable", category: "target", severity: "informational", metric: "equityIRR" }],
      FLIP_VERDICT_MODEL_VERSION
    );
  }

  // ---- Step 4: target missed -> Does Not Meet Target (section 23, 58) —
  // precedes Strong-evidence evaluation entirely, even for an excellent
  // post-renovation valuation.
  if (equityIRR < discountRate) {
    return available(
      "does_not_meet_target",
      { viability: "profitable", target: "missed", exitEvidence: "unavailable" },
      [
        { code: "flip_profitable", category: "safety", severity: "informational", metric: "estimatedProfitBeforeTax", value: profit },
        { code: "target_missed", category: "target", severity: "high", metric: "irr", value: equityIRR, params: { requiredReturn: discountRate } },
      ],
      [{ code: "target_missed", category: "target", severity: "high", metric: "irr", value: equityIRR, params: { requiredReturn: discountRate } }],
      FLIP_VERDICT_MODEL_VERSION
    );
  }

  // ---- Step 5: target met -> evaluate Strong's post-renovation downside
  // evidence gate (section 49, mandatory order) ----------------------------
  const baseReasons: VerdictReason[] = [
    { code: "flip_profitable", category: "safety", severity: "informational", metric: "estimatedProfitBeforeTax", value: profit },
    { code: "target_met", category: "target", severity: "informational", metric: "irr", value: equityIRR, params: { requiredReturn: discountRate } },
  ];
  if (buffer !== null) {
    baseReasons.push({ code: "flip_sale_price_buffer_context", category: "performance", severity: "informational", metric: "salePriceBufferPercent", value: buffer });
  }

  const evidenceResult = evaluateStrongEvidence(flipExitValueAnalysis);

  if (!evidenceResult.cleared) {
    const blockerReason = STRONG_BLOCKER_REASON[evidenceResult.blocker]({ discountRate });
    return available(
      "promising",
      { viability: "profitable", target: "met", exitEvidence: "insufficient" },
      [...baseReasons, blockerReason],
      [blockerReason],
      FLIP_VERDICT_MODEL_VERSION
    );
  }

  // ---- Step 6: Strong (section 49, 20) — Base viable, target met, valid
  // post-renovation Conservative Case remains profitable. Conservative
  // Rand profit and its own target result are always surfaced (never
  // hidden), so an economically thin conservative margin is visible on its
  // face rather than passing a hidden gate (section 75's disclosure
  // mitigation, chosen instead of inventing a minimum-margin threshold).
  const conservativeProfitReason: VerdictReason = {
    code: "conservative_case_profitable",
    category: "safety",
    severity: "informational",
    metric: "estimatedProfitBeforeTax",
    value: evidenceResult.conservative.summary.estimatedProfitBeforeTax,
  };
  const conservativeTargetReason = buildConservativeTargetSupportingReason(evidenceResult.conservative);

  return available(
    "strong",
    { viability: "profitable", target: "met", exitEvidence: "strong" },
    [...baseReasons, conservativeProfitReason, conservativeTargetReason],
    [],
    FLIP_VERDICT_MODEL_VERSION
  );
}
