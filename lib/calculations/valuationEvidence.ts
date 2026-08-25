/**
 * Valuation Trust & Evidence Architecture (Phase 4.24).
 *
 * AssetVerdict has several distinct concepts of "property value" — Purchase
 * Price, the investor's own Estimated Current Market Value, evidence-based
 * valuations (PropertyValuation), post-renovation/exit assumptions, and
 * future projected values. None of these are interchangeable, and none of
 * them may silently stand in for another. This module is the ONE place
 * that assembles them into a single, honest picture — no UI component may
 * compute any of this independently.
 *
 * Core rule (Phase 4.24 acceptance rule): a value is never treated as
 * authoritative unless AssetVerdict knows where it came from and what it
 * represents. `valuationBasis` decides WHAT a PropertyValuation evidence
 * record describes; an "unknown" basis populates NEITHER
 * evidenceBasedCurrentValue NOR evidenceBasedPostRenovationValue — it fails
 * closed, exactly like Phase 4.20's normalizePropertyValuationBasis.
 *
 * This module deliberately has NO verdict/threshold authority (Phase 4.24
 * §23) — evidenceQuality/variance/everything here is informational only,
 * consumed by the Summary UI, PDF, and Deal Coach, never by verdict.ts,
 * thresholds.ts, or calcEstimatedValueLTV (which continues to read only
 * the user's own estimate, unchanged from Phase 4.23.1).
 */
import { isFiniteNumber } from "./index";
import type { FlipExitValuationInput, FlipExitValueValuationBasis } from "./fixFlipExitValue";

// ---------------------------------------------------------------------------
// Valuation source model (Phase 4.24 §4)
// ---------------------------------------------------------------------------

/**
 * Broad source categories AssetVerdict distinguishes conceptually — these
 * do NOT carry equal reliability (a user estimate and a bank valuation are
 * not the same kind of evidence). `PropertyValuation.reportSource` remains
 * a free-text string (no schema/enum change in this phase — normalising it
 * safely, per the audit's own instruction to avoid an unnecessary
 * migration); this is a best-effort, keyword-based classification of that
 * string, not a verified determination. Fails closed to "other_unknown" for
 * anything unrecognised — the same fail-closed convention
 * normalizePropertyValuationBasis (fixFlipExitValue.ts, Phase 4.20.1)
 * already established for valuationBasis.
 */
export type ValuationSourceCategory =
  | "user_estimate"
  | "agent_cma"
  | "avm"
  | "comparable_sales_analysis"
  | "independent_valuation"
  | "bank_valuation"
  | "other_unknown";

/**
 * Keyword classification of a raw `reportSource` string. Deliberately
 * conservative: a source string that doesn't clearly match a known category
 * (including an empty/missing one) normalises to "other_unknown" rather
 * than guessing upward into a more trustworthy-sounding bucket — see
 * calcValuationEvidenceQuality's own doc comment on why label alone must
 * never imply reliability.
 */
export function classifyValuationSource(reportSource: string | null | undefined): ValuationSourceCategory {
  if (!reportSource || !reportSource.trim()) return "other_unknown";
  const s = reportSource.toLowerCase();
  if (s.includes("bank")) return "bank_valuation";
  if (s.includes("independent") || s.includes("professional") || s.includes("sworn") || s.includes("registered valuer")) {
    return "independent_valuation";
  }
  if (s.includes("tpn") || s.includes("avm") || s.includes("automated")) return "avm";
  if (s.includes("comparable") || s.includes("cma")) return "comparable_sales_analysis";
  if (s.includes("agent") || s.includes("estate agent")) return "agent_cma";
  if (s.includes("user") || s.includes("self") || s.includes("investor estimate")) return "user_estimate";
  return "other_unknown";
}

// ---------------------------------------------------------------------------
// Evidence quality model (Phase 4.24 §5) — conceptual, internal, NOT a
// verdict threshold. Mirrors thresholds.ts's own `evidenceLevel: "internal"`
// honesty convention: this is AssetVerdict's own scale, not an externally
// validated one.
// ---------------------------------------------------------------------------

export type ValuationEvidenceQuality = "unverified" | "indicative" | "supported" | "strong_evidence";

export interface ValuationEvidenceQualityInput {
  estimatedValue: number | null;
  valueConfidenceLow: number | null;
  valueConfidenceHigh: number | null;
  sourceCategory: ValuationSourceCategory;
  comparableCount: number;
  valuationBasis: FlipExitValueValuationBasis;
}

/**
 * Deterministic, source-and-corroboration-aware quality tier — NEVER a
 * verdict input (Phase 4.24 §23). A source's label alone is never enough
 * for "Strong Evidence" (§5: "Do not automatically assume any source is
 * 'Strong' merely because of its label") — a bank/independent valuation
 * still needs a known basis plus at least one piece of corroborating detail
 * (a confidence range or a recorded comparable) before it earns that tier.
 * "3 comparables exist" does not automatically imply quality either (§9) —
 * comparableCount only ever contributes alongside a real source category or
 * a genuine confidence range, never on its own for the top two tiers.
 */
export function calcValuationEvidenceQuality(input: ValuationEvidenceQualityInput): ValuationEvidenceQuality {
  const hasEstimate = isFiniteNumber(input.estimatedValue) && input.estimatedValue > 0;
  if (!hasEstimate) return "unverified";

  const hasConfidenceRange =
    isFiniteNumber(input.valueConfidenceLow) &&
    isFiniteNumber(input.valueConfidenceHigh) &&
    input.valueConfidenceLow > 0 &&
    input.valueConfidenceHigh >= input.valueConfidenceLow;
  const knownBasis = input.valuationBasis !== "unknown";
  const comparableCount = Math.max(0, input.comparableCount);

  if (
    (input.sourceCategory === "bank_valuation" || input.sourceCategory === "independent_valuation") &&
    knownBasis &&
    (hasConfidenceRange || comparableCount >= 1)
  ) {
    return "strong_evidence";
  }

  if (
    knownBasis &&
    (comparableCount >= 2 ||
      ((input.sourceCategory === "avm" || input.sourceCategory === "comparable_sales_analysis") && hasConfidenceRange) ||
      input.sourceCategory === "bank_valuation" ||
      input.sourceCategory === "independent_valuation")
  ) {
    return "supported";
  }

  if (input.sourceCategory === "avm" || input.sourceCategory === "agent_cma" || comparableCount === 1 || hasConfidenceRange) {
    return "indicative";
  }

  return "unverified";
}

// ---------------------------------------------------------------------------
// Valuation variance (Phase 4.24 §12) — informational only, never a
// red/orange/green judgement.
// ---------------------------------------------------------------------------

export interface ValuationVariance {
  userEstimate: number;
  evidenceValue: number;
  differenceRand: number;
  differencePercent: number;
}

/**
 * Only computed when BOTH figures are valid, positive, AND comparable on
 * the same basis (the caller must pass evidenceBasedCurrentValue —
 * current-condition only — never a post-renovation or future figure).
 */
export function calcValuationVariance(
  userEstimatedCurrentMarketValue: number | null,
  evidenceBasedCurrentValue: number | null
): ValuationVariance | null {
  if (!isFiniteNumber(userEstimatedCurrentMarketValue) || userEstimatedCurrentMarketValue <= 0) return null;
  if (!isFiniteNumber(evidenceBasedCurrentValue) || evidenceBasedCurrentValue <= 0) return null;
  const differenceRand = userEstimatedCurrentMarketValue - evidenceBasedCurrentValue;
  return {
    userEstimate: userEstimatedCurrentMarketValue,
    evidenceValue: evidenceBasedCurrentValue,
    differenceRand,
    differencePercent: (differenceRand / evidenceBasedCurrentValue) * 100,
  };
}

// ---------------------------------------------------------------------------
// The one valuation summary (Phase 4.24 §10) — every UI/PDF/Deal Coach
// consumer reads THIS, never PropertyValuation or DealInputs.marketValue
// directly for a "what is this property worth" question.
// ---------------------------------------------------------------------------

export interface ValuationSummary {
  /** The investor's own estimate (DealInputs.estimatedMarketValue, Phase 4.23.1) — trust level: User Estimate. Never bank-confirmed. */
  userEstimatedCurrentMarketValue: number | null;
  /** ONLY populated when valuationBasis === "current_condition" — never post-renovation, never future, never "unknown" (fail closed). */
  evidenceBasedCurrentValue: number | null;
  evidenceValueLow: number | null;
  evidenceValueHigh: number | null;
  /** ONLY populated when valuationBasis === "post_renovation". A different concept from evidenceBasedCurrentValue — never merged with it. */
  evidenceBasedPostRenovationValue: number | null;
  /** An ASSUMPTION (e.g. Fix & Flip's own expectedSalePrice), never evidence — caller-supplied, optional. */
  assumedFutureSalePrice: number | null;
  valuationSource: string | null;
  valuationSourceCategory: ValuationSourceCategory;
  valuationBasis: FlipExitValueValuationBasis;
  valuationDate: Date | string | null;
  /** Whole days since valuationDate — exposed for display ("Valuation Date: 12 Aug 2026"); NO Recent/Older/Stale classification is made in this phase (Phase 4.24 §8 — no hard age threshold has been justified yet). */
  valuationAgeDays: number | null;
  comparableCount: number;
  valuationEvidenceQuality: ValuationEvidenceQuality;
  /** Only set when both userEstimatedCurrentMarketValue and evidenceBasedCurrentValue are valid — never fabricated from mismatched bases. */
  variance: ValuationVariance | null;
}

export function buildValuationSummary(params: {
  userEstimatedCurrentMarketValue: number | null | undefined;
  valuation: FlipExitValuationInput | null;
  assumedFutureSalePrice?: number | null;
  now?: Date;
}): ValuationSummary {
  const { valuation, now = new Date() } = params;
  const assumedFutureSalePrice =
    isFiniteNumber(params.assumedFutureSalePrice) && params.assumedFutureSalePrice > 0
      ? params.assumedFutureSalePrice
      : null;
  const userEstimatedCurrentMarketValue =
    isFiniteNumber(params.userEstimatedCurrentMarketValue) && params.userEstimatedCurrentMarketValue > 0
      ? params.userEstimatedCurrentMarketValue
      : null;

  const valuationBasis: FlipExitValueValuationBasis = valuation?.valuationBasis ?? "unknown";
  const sourceCategory = classifyValuationSource(valuation?.reportSource ?? null);

  const rawEstimate =
    isFiniteNumber(valuation?.estimatedValue) && valuation!.estimatedValue! > 0 ? valuation!.estimatedValue! : null;
  const rawLow =
    isFiniteNumber(valuation?.valueConfidenceLow) && valuation!.valueConfidenceLow! > 0
      ? valuation!.valueConfidenceLow!
      : null;
  const rawHigh =
    isFiniteNumber(valuation?.valueConfidenceHigh) && valuation!.valueConfidenceHigh! > 0
      ? valuation!.valueConfidenceHigh!
      : null;

  // Phase 4.24 §7, the central acceptance rule: only "current_condition"
  // may ever populate a CURRENT-value field. "post_renovation" populates
  // the separate post-renovation field instead. "unknown" populates
  // NEITHER — never guessed, never defaulted.
  const evidenceBasedCurrentValue = valuationBasis === "current_condition" ? rawEstimate : null;
  const evidenceBasedPostRenovationValue = valuationBasis === "post_renovation" ? rawEstimate : null;
  const evidenceValueLow = valuationBasis === "current_condition" ? rawLow : null;
  const evidenceValueHigh = valuationBasis === "current_condition" ? rawHigh : null;

  let valuationAgeDays: number | null = null;
  if (valuation?.reportDate) {
    const asOf = new Date(valuation.reportDate).getTime();
    if (isFinite(asOf)) {
      valuationAgeDays = Math.max(0, Math.round((now.getTime() - asOf) / 86_400_000));
    }
  }

  const comparableCount = valuation?.comparableCount ?? 0;

  const valuationEvidenceQuality = calcValuationEvidenceQuality({
    estimatedValue: rawEstimate,
    valueConfidenceLow: rawLow,
    valueConfidenceHigh: rawHigh,
    sourceCategory,
    comparableCount,
    valuationBasis,
  });

  const variance = calcValuationVariance(userEstimatedCurrentMarketValue, evidenceBasedCurrentValue);

  return {
    userEstimatedCurrentMarketValue,
    evidenceBasedCurrentValue,
    evidenceValueLow,
    evidenceValueHigh,
    evidenceBasedPostRenovationValue,
    assumedFutureSalePrice,
    valuationSource: valuation?.reportSource ?? null,
    valuationSourceCategory: sourceCategory,
    valuationBasis,
    valuationDate: valuation?.reportDate ?? null,
    valuationAgeDays,
    comparableCount,
    valuationEvidenceQuality,
    variance,
  };
}
