/**
 * Fix & Flip Exit-Value Confidence Model (Phase 4.19).
 *
 * `expectedSalePrice` (Base case) is, and remains, the investor's own
 * assumption — this module never overwrites it, never mutates the stored
 * deal, and never syncs it to any valuation figure. What this module adds
 * is a deterministic COMPARISON between that assumption and whatever
 * numeric property-valuation evidence (`PropertyValuation`) is recorded
 * against the deal, plus one or two additional Flip scenarios re-run
 * through the EXACT SAME `calcFixFlipAnalysis` engine at evidence-backed
 * (never invented) sale prices:
 *
 *   - Valuation Point Case: min(expectedSalePrice, estimatedValue) — the
 *     recorded point estimate, never allowed to exceed the user's own
 *     assumption.
 *   - Conservative Valuation Case: min(expectedSalePrice, valueConfidenceLow)
 *     — the recorded lower confidence bound, same rule.
 *
 * No second Flip profit/ROI/IRR engine exists here — every scenario is
 * produced by re-invoking calcFixFlipAnalysis on a cloned DealInputs with
 * only `expectedSalePrice` changed (buildFlipSalePriceScenarioInputs), and
 * every number in a scenario summary is read straight off that result.
 *
 * No universal haircut (-5%, -10%, -15%) is ever applied. No Sale-Price
 * Buffer threshold is ever applied. This module produces evidence and
 * scenarios only — it issues no verdict, and Fix & Flip's overall verdict
 * remains "unavailable" regardless of what this module finds (Phase 4.18
 * left that gap open; Phase 4.19 does not close it).
 *
 * `hasMeaningfulPropertyValuation()` (lib/propertyValuation.ts) is
 * deliberately NOT reused as the gate here — it answers "does this record
 * contain anything meaningful" (bond history alone qualifies), which is
 * too broad a bar for "do we have a numeric anchor for a sale-price
 * scenario." This module's own, stricter numeric-evidence policy is
 * documented inline below.
 */
import type { DealInputs } from "./index";
import { calcFixFlipAnalysis, type FixFlipAnalysisAvailable, type FixFlipAnalysisUnavailableReason } from "./fixFlip";

// ---------------------------------------------------------------------------
// Input shape — deliberately narrower than the full Prisma-hydrated
// PropertyValuation (mirrors metricBreakdowns.ts's AcquisitionSummary
// convention: lib/calculations stays decoupled from the DB/relations
// shape). The caller (the /calculate route) maps the real record onto this.
// ---------------------------------------------------------------------------

export interface FlipExitValuationInput {
  estimatedValue: number | null;
  valueConfidenceLow: number | null;
  valueConfidenceHigh: number | null;
  valuationConfidence: string | null;
  reportSource: string | null;
  reportDate: Date | string | null;
  comparableCount: number;
}

// ---------------------------------------------------------------------------
// Output model
// ---------------------------------------------------------------------------

/**
 * Descriptive summary of what numeric evidence is available — informative,
 * not a gate by itself. `valuationPointCase`/`conservativeCase` presence on
 * the outer `FlipExitValueAnalysis` is the actual computed gate (see
 * `pointCaseAvailable`/`conservativeCaseAvailable` in the implementation);
 * this status exists for UI/Deal Coach explanatory copy, and to distinguish
 * evidence tiers a single boolean pair can't name (e.g. "we have a lower
 * bound but no central estimate" vs. "we have an estimate but no lower
 * bound" are different evidential situations, not the same one twice).
 */
export type FlipExitValueEvidenceStatus =
  | "no_numeric_valuation"
  | "point_estimate_only"
  | "lower_bound_only"
  | "valuation_range_available"
  | "invalid_valuation";

export type FlipExitValueRangePosition = "below_range" | "within_range" | "above_range";

/**
 * Whether the recorded valuation reflects the property's current
 * condition, its post-renovation/completed condition, or something else
 * (Phase 4.19.1, section 11-13). `PropertyValuation` has no field that
 * records this today, and this module never infers it — not from
 * `reportSource`, not from the strategy being Fix & Flip, not from
 * anything else — so this is a literal singleton type: it can only ever
 * be "unknown" until a future phase adds a real, explicit basis field and
 * deliberately widens this type. That narrowness is the point (section 15,
 * 39): it is a compile-time guardrail against a future verdict phase
 * silently treating "a valuation is recorded" as "post-renovation exit
 * value is confirmed" — two very different claims this module refuses to
 * conflate. Unknown basis does NOT invalidate the valuation, does NOT
 * block the Point/Conservative scenarios below, and does NOT change any
 * financial figure — it only limits how much interpretive authority a
 * future verdict may give this evidence (supporting evidence, not
 * confirmed exit-price proof).
 */
export type FlipExitValueValuationBasis = "unknown";

export interface FlipExitValueEvidence {
  status: FlipExitValueEvidenceStatus;
  /** See FlipExitValueValuationBasis's own doc comment — always "unknown" today, deliberately. */
  valuationBasis: FlipExitValueValuationBasis;

  reportSource: string | null;
  reportDate: Date | string | null;
  /** Whole days between `reportDate` and the analysis's `now` — descriptive only, no freshness cutoff (section 13/48: no evidence supports one). Undefined when `reportDate` is absent. */
  valuationAgeDays?: number;

  estimatedValue?: number;
  valueConfidenceLow?: number;
  valueConfidenceHigh?: number;
  /** Carried through exactly as recorded (e.g. "High"/"Medium"/"Low") — never converted into a numeric threshold or a Strong/Weak signal (section 39). */
  valuationConfidence: string | null;

  /** Only present when a full, internally-consistent low/estimated/high triple exists (section 6, 40). */
  rangeWidthRand?: number;
  rangeWidthPercent?: number;

  /** expectedSalePrice vs. estimatedValue — only when a usable estimate exists. Descriptive, never classified as safe/unsafe (section 9, 11). */
  expectedVsEstimateRand?: number;
  expectedVsEstimatePercent?: number;

  /** Only present for a full, valid low/estimated/high triple (section 10). A mathematical relationship, never a judgement (section 11). */
  rangePosition?: FlipExitValueRangePosition;

  comparableCount: number;
}

/** A compact projection of a FixFlipAnalysisAvailable result — every field here is read directly off a real calcFixFlipAnalysis() call, never independently computed (section 23-24). */
export interface FlipSalePriceScenarioSummary {
  salePrice: number;
  estimatedProfitBeforeTax: number;
  preTaxProjectROI: number;
  equityIRR: number | null;
  annualisedPreTaxROI: number | null;
  breakEvenSalePrice: number | null;
  salePriceBufferRand: number | null;
  salePriceBufferPercent: number | null;
  /** From Estimated Profit Before Tax's sign only (section 26) — a scenario fact, not the overall Flip verdict. */
  viability: "profitable" | "break_even_or_loss";
  /** Equity IRR vs. the deal's own Required Return (discountRate) — raw comparison, no invented band (section 25). "unknown" when Equity IRR did not converge. */
  targetState: "met" | "missed" | "unknown";
}

export interface FlipExitValueBaseCase {
  salePrice: number;
  summary: FlipSalePriceScenarioSummary;
}

export interface FlipExitValueScenarioCase {
  salePrice: number;
  /** True when the evidence-backed price was not lower than expectedSalePrice, so the scenario is identical to Base (section 19) — correct, not an error. */
  sameAsBase: boolean;
  summary: FlipSalePriceScenarioSummary;
}

export interface FlipExitValueConservativeCase extends FlipExitValueScenarioCase {
  /** "Project remains profitable before tax at the recorded lower valuation bound." Descriptive only — never "safe"/"Strong"/"low risk" (section 27). */
  survivesConservativeCase: boolean;
  /** Kept distinct from survivesConservativeCase (section 28) — a deal can remain profitable while still missing the investor's own Required Return. Null when the scenario's target state is "unknown" (Equity IRR did not converge). */
  meetsRequiredReturnInConservativeCase: boolean | null;
}

export type FlipExitValueAnalysisUnavailableReason = FixFlipAnalysisUnavailableReason;

export interface FlipExitValueAnalysisUnavailable {
  status: "unavailable";
  reason: FlipExitValueAnalysisUnavailableReason;
}

export interface FlipExitValueAnalysisAvailable {
  status: "available";
  expectedSalePrice: number;
  evidence: FlipExitValueEvidence;
  baseCase: FlipExitValueBaseCase;
  /** Present only when a usable point estimate exists and the evidence is internally consistent (section 17-18). */
  valuationPointCase?: FlipExitValueScenarioCase;
  /** Present only when a usable lower confidence bound exists and the evidence is internally consistent (section 15-16). Never derived from a percentage haircut. */
  conservativeCase?: FlipExitValueConservativeCase;
  modelVersion: "4.19";
}

export type FlipExitValueAnalysis = FlipExitValueAnalysisAvailable | FlipExitValueAnalysisUnavailable;

// ---------------------------------------------------------------------------
// Numeric evidence policy (section 5-7, 36-37)
// ---------------------------------------------------------------------------

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && isFinite(value) && value > 0;
}

// ---------------------------------------------------------------------------
// Pure scenario input builder (section 20) — clones DealInputs, changes
// ONLY expectedSalePrice. Every other assumption (purchase price,
// renovation, finance sources, holding period, selling-cost percentage,
// tax rates) is untouched, matching the exact cloning convention already
// used by lib/calculations/negotiation.ts's buildNegotiatedInputs.
// ---------------------------------------------------------------------------

export function buildFlipSalePriceScenarioInputs(inputs: DealInputs, scenarioSalePrice: number): DealInputs {
  return { ...inputs, expectedSalePrice: scenarioSalePrice };
}

// ---------------------------------------------------------------------------
// Scenario summary — reuses calcFixFlipAnalysis exclusively (section 21, 75)
// ---------------------------------------------------------------------------

function deriveTargetState(equityIRR: number | null, discountRate: number): "met" | "missed" | "unknown" {
  if (equityIRR === null || !isFinite(equityIRR) || !isFinite(discountRate)) return "unknown";
  return equityIRR >= discountRate ? "met" : "missed";
}

function summarize(analysis: FixFlipAnalysisAvailable, salePrice: number, discountRate: number): FlipSalePriceScenarioSummary {
  const { profitability, breakEven } = analysis;
  return {
    salePrice,
    estimatedProfitBeforeTax: profitability.estimatedProfitBeforeTax,
    preTaxProjectROI: profitability.preTaxProjectROI,
    equityIRR: profitability.equityIRR,
    annualisedPreTaxROI: profitability.annualisedPreTaxROI,
    breakEvenSalePrice: breakEven.breakEvenSalePrice,
    salePriceBufferRand: breakEven.salePriceBufferRand,
    salePriceBufferPercent: breakEven.salePriceBufferPercent,
    viability: profitability.estimatedProfitBeforeTax > 0 ? "profitable" : "break_even_or_loss",
    targetState: deriveTargetState(profitability.equityIRR, discountRate),
  };
}

/** Re-runs calcFixFlipAnalysis at `salePrice` and summarizes it, or returns null if that candidate genuinely can't be analysed (defensive only — a positive salePrice substituted into an already-valid deal always succeeds in practice, since holding period validity is independent of sale price). */
function runScenario(inputs: DealInputs, salePrice: number, discountRate: number): FlipSalePriceScenarioSummary | null {
  const result = calcFixFlipAnalysis(buildFlipSalePriceScenarioInputs(inputs, salePrice));
  if (result.status !== "available") return null;
  return summarize(result, salePrice, discountRate);
}

// ---------------------------------------------------------------------------
// Evidence assessment (section 4-14, 36-40)
// ---------------------------------------------------------------------------

function buildEvidence(
  valuation: FlipExitValuationInput | null,
  expectedSalePrice: number,
  now: Date
): { evidence: FlipExitValueEvidence; pointEstimate: number | null; lowerBound: number | null; invalid: boolean } {
  const reportSource = valuation?.reportSource ?? null;
  const reportDate = valuation?.reportDate ?? null;
  const valuationConfidence = valuation?.valuationConfidence ?? null;
  const comparableCount = valuation?.comparableCount ?? 0;

  const rawLow = valuation?.valueConfidenceLow ?? null;
  const rawEst = valuation?.estimatedValue ?? null;
  const rawHigh = valuation?.valueConfidenceHigh ?? null;

  const hasLow = isUsableNumber(rawLow);
  const hasEst = isUsableNumber(rawEst);
  const hasHigh = isUsableNumber(rawHigh);

  // Validate every relationship that CAN be tested from the values actually
  // present — never a missing one, never an inferred one (Phase 4.19.1,
  // section 2). Three independent pairwise checks, each firing only when
  // both its values exist, together cover every combination: a lone value
  // is never contradictory by itself, but low>estimate or estimate>high is
  // just as contradictory when the third value is absent as when all three
  // are present — the previous version only validated the full triple and
  // the low/high pair, silently accepting low>estimate (or estimate>high)
  // whenever the missing third value happened to be the one that would
  // otherwise have exposed it.
  let invalid = false;
  if (hasLow && hasEst && !(rawLow! <= rawEst!)) invalid = true;
  if (hasEst && hasHigh && !(rawEst! <= rawHigh!)) invalid = true;
  if (hasLow && hasHigh && !(rawLow! <= rawHigh!)) invalid = true;

  const fullRangeValid = hasLow && hasEst && hasHigh && !invalid;
  const pointEstimate = hasEst && !invalid ? rawEst! : null;
  const lowerBound = hasLow && !invalid ? rawLow! : null;

  let status: FlipExitValueEvidenceStatus;
  if (invalid) status = "invalid_valuation";
  else if (fullRangeValid) status = "valuation_range_available";
  else if (hasEst) status = "point_estimate_only";
  else if (hasLow) status = "lower_bound_only";
  else status = "no_numeric_valuation";

  let valuationAgeDays: number | undefined;
  if (reportDate) {
    const asOf = new Date(reportDate).getTime();
    if (isFinite(asOf)) {
      valuationAgeDays = Math.max(0, Math.round((now.getTime() - asOf) / 86_400_000));
    }
  }

  let rangeWidthRand: number | undefined;
  let rangeWidthPercent: number | undefined;
  let rangePosition: FlipExitValueRangePosition | undefined;
  if (fullRangeValid) {
    rangeWidthRand = rawHigh! - rawLow!;
    rangeWidthPercent = rawEst! > 0 ? (rangeWidthRand / rawEst!) * 100 : undefined;
    rangePosition = expectedSalePrice < rawLow! ? "below_range" : expectedSalePrice > rawHigh! ? "above_range" : "within_range";
  }

  let expectedVsEstimateRand: number | undefined;
  let expectedVsEstimatePercent: number | undefined;
  if (pointEstimate !== null) {
    expectedVsEstimateRand = expectedSalePrice - pointEstimate;
    expectedVsEstimatePercent = pointEstimate > 0 ? (expectedVsEstimateRand / pointEstimate) * 100 : undefined;
  }

  const evidence: FlipExitValueEvidence = {
    status,
    // Always "unknown" — see FlipExitValueValuationBasis's doc comment.
    // Set unconditionally, independent of `status`/`invalid`: even a
    // no-valuation or invalid-valuation record has an (unknown) basis in
    // the trivial sense that there's nothing to know a basis about, and a
    // future reader must never be able to read a missing field as "basis
    // confirmed" by omission.
    valuationBasis: "unknown",
    reportSource,
    reportDate,
    valuationAgeDays,
    estimatedValue: hasEst ? rawEst! : undefined,
    valueConfidenceLow: hasLow ? rawLow! : undefined,
    valueConfidenceHigh: hasHigh ? rawHigh! : undefined,
    valuationConfidence,
    rangeWidthRand,
    rangeWidthPercent,
    expectedVsEstimateRand,
    expectedVsEstimatePercent,
    rangePosition,
    comparableCount,
  };

  return { evidence, pointEstimate, lowerBound, invalid };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Pure given `now` (defaults to the current time when omitted — callers
 * that need deterministic output, e.g. tests, should pass `now`
 * explicitly). Never mutates `inputs` or `valuation`. Never blocks Flip
 * financial analysis: Base case is always produced whenever the underlying
 * `calcFixFlipAnalysis` succeeds, regardless of what valuation evidence
 * exists (section 34).
 */
export function calcFlipExitValueAnalysis(params: {
  inputs: DealInputs;
  valuation: FlipExitValuationInput | null;
  now?: Date;
}): FlipExitValueAnalysis {
  const { inputs, valuation, now = new Date() } = params;

  const baseAnalysis = calcFixFlipAnalysis(inputs);
  if (baseAnalysis.status !== "available") {
    return { status: "unavailable", reason: baseAnalysis.reason };
  }

  const expectedSalePrice = inputs.expectedSalePrice;
  const discountRate = inputs.discountRate;
  const { evidence, pointEstimate, lowerBound } = buildEvidence(valuation, expectedSalePrice, now);

  const baseCase: FlipExitValueBaseCase = {
    salePrice: expectedSalePrice,
    summary: summarize(baseAnalysis, expectedSalePrice, discountRate),
  };

  let valuationPointCase: FlipExitValueScenarioCase | undefined;
  if (pointEstimate !== null) {
    // Never raises the user's own sale price (section 16, 17).
    const pointPrice = Math.min(expectedSalePrice, pointEstimate);
    const summary = runScenario(inputs, pointPrice, discountRate);
    if (summary) {
      valuationPointCase = { salePrice: pointPrice, sameAsBase: pointPrice === expectedSalePrice, summary };
    }
  }

  let conservativeCase: FlipExitValueConservativeCase | undefined;
  if (lowerBound !== null) {
    const conservativePrice = Math.min(expectedSalePrice, lowerBound);
    const summary = runScenario(inputs, conservativePrice, discountRate);
    if (summary) {
      conservativeCase = {
        salePrice: conservativePrice,
        sameAsBase: conservativePrice === expectedSalePrice,
        summary,
        survivesConservativeCase: summary.viability === "profitable",
        meetsRequiredReturnInConservativeCase: summary.targetState === "unknown" ? null : summary.targetState === "met",
      };
    }
  }

  return {
    status: "available",
    expectedSalePrice,
    evidence,
    baseCase,
    valuationPointCase,
    conservativeCase,
    modelVersion: "4.19",
  };
}
