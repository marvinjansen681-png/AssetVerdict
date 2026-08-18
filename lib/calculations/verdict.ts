/**
 * Deterministic Overall Verdict Engine (Phase 4.14).
 *
 * Phase 4.12 designed the verdict philosophy; Phase 4.13 audited which
 * metrics have earned enough evidence to drive it. This is the first
 * production implementation — deliberately conservative, per the Phase 4.14
 * brief: only DSCR, Break-Even Ratio, LTV, OER, and Equity IRR may
 * materially affect the overall verdict. Everything else (Cap Rate PP,
 * Gross Yield, Cap Rate Spread, Cap Rate MV, Cash-on-Cash, Payback, NPV,
 * Utilities Ratio) is context/supporting only and carries zero authority to
 * change a category state or the overall verdict.
 *
 * Architecture (Phase 4.14 section 73):
 *   financial metrics
 *         ↓
 *   metric classifications (lib/calculations/thresholds.ts — unchanged)
 *         ↓
 *   raw structural checks (ONLY the two explicitly approved: DSCR < 1.00,
 *   Break-Even Ratio > 100% — plus the target raw check, IRR >= Required
 *   Return; no other hardcoded threshold is introduced here)
 *         ↓
 *   category states (safety / operating / target)
 *         ↓
 *   overall verdict + structured reasons
 *
 * This module computes NOTHING new about the deal — every number it reads
 * (metrics.dscr, metrics.breakEvenRatio, metrics.irr, ...) already came from
 * calcAllMetrics(). It only aggregates already-classified, already-computed
 * facts into one deterministic, explainable verdict. It is a pure function:
 * no I/O, no AI, no randomness, safe to call on every /calculate request
 * without persisting anything (Phase 4.14 section 45 — verdict is DERIVED,
 * never a database column).
 */
import type { DealInputs, DealMetrics } from "./index";
import { isFiniteNumber } from "./index";
import {
  classifyMetricForDeal,
  applicabilityContextFromInputs,
  type ApplicabilityContext,
} from "./applicability";
import type { MetricClassification } from "./thresholds";

// ---------------------------------------------------------------------------
// Strategy eligibility (Phase 4.14 section 1)
// ---------------------------------------------------------------------------

/**
 * Only these five strategies have earned enough calibrated evidence
 * (Phase 4.13) to support an overall verdict. Fix & Flip and Instalment
 * Sale are deliberately excluded — see deriveDealVerdict's early-return
 * branches for why each specifically is unavailable, not just "not yet
 * enabled."
 */
export const VERDICT_ENABLED_STRATEGIES = new Set([
  "commercial",
  "buy_to_let",
  "multi_let",
  "student",
  "str",
]);

/**
 * A lightweight, derived-only version tag (Phase 4.14 section 126) — never
 * persisted, exists purely so exported/debugged verdict output can be
 * matched back to the rule set that produced it once a future phase
 * legitimately changes the aggregation rules.
 */
export const VERDICT_MODEL_VERSION = "4.14";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The five approved normal verdict labels (Phase 4.12/4.13/4.14) — no new label is added here. */
export type VerdictLabel = "strong" | "promising" | "promising_if_negotiated" | "high_risk" | "does_not_meet_target";

/**
 * Why an eligible-looking request still can't produce a normal verdict.
 * Kept structurally separate from VerdictLabel (Phase 4.14 section 4) so
 * "AssetVerdict doesn't judge this yet" can never be confused with one of
 * the five real judgements.
 */
export type VerdictUnavailableReason =
  | "strategy_model_incomplete"
  | "insufficient_calibrated_evidence"
  | "insufficient_required_inputs";

export type SafetyState = "strong" | "acceptable" | "weak" | "unknown";
export type OperatingState = "strong" | "acceptable" | "weak" | "unknown";
export type TargetState = "met" | "missed" | "unknown";

export type VerdictReasonCategory = "safety" | "operating" | "target" | "performance" | "availability";
export type VerdictReasonSeverity = "blocking" | "high" | "moderate" | "informational";

/**
 * Structured, deterministic reason — no AI-generated prose lives in this
 * engine (Phase 4.14 section 46). UI/education/Deal Coach format these into
 * copy; the engine only ever emits stable `code`s plus the exact values a
 * downstream formatter needs.
 */
export interface VerdictReason {
  code: string;
  category: VerdictReasonCategory;
  severity: VerdictReasonSeverity;
  metric?: string;
  value?: number | null;
  classification?: MetricClassification | null;
  params?: Record<string, number | string | boolean | null>;
}

export interface DealVerdictCategoryStates {
  safety: SafetyState;
  operating: OperatingState;
  target: TargetState;
}

export interface DealVerdictAvailable {
  status: "available";
  verdict: VerdictLabel;
  categoryStates: DealVerdictCategoryStates;
  reasons: VerdictReason[];
  blockers: VerdictReason[];
  verdictModelVersion: string;
}

export interface DealVerdictUnavailable {
  status: "unavailable";
  reason: VerdictUnavailableReason;
  reasons: VerdictReason[];
  verdictModelVersion: string;
}

export type DealVerdictResult = DealVerdictAvailable | DealVerdictUnavailable;

// ---------------------------------------------------------------------------
// Structural High Risk (Phase 4.14 sections 7, 9, 16) — the ONLY two raw,
// non-classification-derived checks this engine is allowed to make. Every
// other judgement below reuses classifyMetricForDeal from thresholds.ts —
// see section 125: "the only exceptions are the explicitly approved
// structural raw checks."
// ---------------------------------------------------------------------------

export interface StructuralSafetyCheckParams {
  dscr: number;
  hasDebt: boolean;
  breakEvenRatio: number;
  cashflowAnnualPreTax: number;
}

/**
 * Condition A: debt exists AND raw DSCR < 1.00 — NOI does not cover debt
 * service, a structural insolvency fact, not "below the green threshold"
 * (those are different concepts — section 7).
 * Condition B: raw Break-Even Ratio > 100% — required operating costs plus
 * debt service exceed gross revenue, which Phase 4.13 proved is exactly the
 * same fact as negative pre-tax annual cashflow (section 12). That cashflow
 * fact is surfaced as a supporting, non-blocking reason here — never a
 * second independent blocker (section 122 — no double-counting).
 */
export function checkStructuralSafetyFailure(params: StructuralSafetyCheckParams): {
  failed: boolean;
  reasons: VerdictReason[];
} {
  const { dscr, hasDebt, breakEvenRatio, cashflowAnnualPreTax } = params;
  const reasons: VerdictReason[] = [];

  if (hasDebt && isFiniteNumber(dscr) && dscr < 1.0) {
    reasons.push({
      code: "dscr_below_1",
      category: "safety",
      severity: "blocking",
      metric: "dscr",
      value: dscr,
    });
  }

  if (isFiniteNumber(breakEvenRatio) && breakEvenRatio > 100) {
    reasons.push({
      code: "break_even_above_100",
      category: "safety",
      severity: "blocking",
      metric: "breakEvenRatio",
      value: breakEvenRatio,
    });
    if (isFiniteNumber(cashflowAnnualPreTax)) {
      reasons.push({
        code: "negative_pretax_cashflow",
        category: "safety",
        severity: "informational",
        metric: "cashflowAnnualPreTax",
        value: cashflowAnnualPreTax,
      });
    }
  }

  return { failed: reasons.some((r) => r.severity === "blocking"), reasons };
}

// ---------------------------------------------------------------------------
// Safety state (Phase 4.14 sections 8, 13-21) — DSCR and Break-Even Ratio
// are the two PRIMARY, structurally-BLOCKER-capable safety metrics; LTV is
// a MODIFIER ONLY, never independently capable of Weak/High Risk (section
// 13). Called only once the structural check above has already passed, so
// "weak" is never returned from this function — Phase 4.14 deliberately
// does not implement caution-compounding into Weak/High Risk yet (section
// 17); that stays reserved for a future phase once evidence supports it.
// ---------------------------------------------------------------------------

export interface DeriveSafetyStateParams {
  dscr: MetricClassification;
  breakEven: MetricClassification;
  ltv: MetricClassification;
}

export function deriveSafetyState(params: DeriveSafetyStateParams): { state: SafetyState; reasons: VerdictReason[] } {
  const { dscr, breakEven, ltv } = params;
  const reasons: VerdictReason[] = [];
  let unknown = false;

  // DSCR: not_applicable (e.g. cash purchase) is REMOVED from required
  // evidence entirely — no penalty, no requirement (section 8, 21). Only an
  // applicable-but-unclassified DSCR pushes Safety to "unknown".
  let dscrFavourable = true;
  if (dscr.status === "unclassified") {
    unknown = true;
    reasons.push({ code: "dscr_unclassified", category: "safety", severity: "moderate", metric: "dscr", classification: dscr });
  } else if (dscr.status === "classified") {
    // Structural check already ruled out "red" (raw < 1.00); only green/orange remain here.
    if (dscr.color !== "green") {
      dscrFavourable = false;
      reasons.push({ code: "dscr_caution", category: "safety", severity: "moderate", metric: "dscr", value: null, classification: dscr });
    }
  }

  // Break-Even Ratio: same not_applicable/unclassified/classified handling.
  // "classified red" here means 90% < value <= 100% (structural check
  // already excluded >100%) — a severe safety weakness that blocks Strong
  // but does NOT independently create High Risk (section 10).
  let breakEvenFavourable = true;
  if (breakEven.status === "unclassified") {
    unknown = true;
    reasons.push({ code: "break_even_unclassified", category: "safety", severity: "moderate", metric: "breakEvenRatio", classification: breakEven });
  } else if (breakEven.status === "classified") {
    if (breakEven.color === "red") {
      breakEvenFavourable = false;
      reasons.push({ code: "break_even_high", category: "safety", severity: "high", metric: "breakEvenRatio", value: null, classification: breakEven });
    } else if (breakEven.color === "orange") {
      breakEvenFavourable = false;
      reasons.push({ code: "break_even_caution", category: "safety", severity: "moderate", metric: "breakEvenRatio", value: null, classification: breakEven });
    }
  }

  // LTV: MODIFIER ONLY (section 13-14). Only a classified-red ("weak")
  // reading blocks Strong; caution/orange is not given that authority in
  // this first release, and LTV never contributes to the "unknown" state —
  // it is not a required PRIMARY safety metric.
  let ltvWarning = false;
  if (ltv.status === "classified" && ltv.color === "red") {
    ltvWarning = true;
    reasons.push({ code: "high_ltv", category: "safety", severity: "moderate", metric: "ltv", value: null, classification: ltv });
  }

  if (unknown) {
    return { state: "unknown", reasons };
  }
  if (dscrFavourable && breakEvenFavourable && !ltvWarning) {
    return { state: "strong", reasons };
  }
  return { state: "acceptable", reasons };
}

// ---------------------------------------------------------------------------
// Operating state (Phase 4.14 sections 22-25, 57) — OER is the ONLY
// verdict-active Operating Quality metric in this first release. Utilities
// Ratio has zero authority; NOI Margin remains informational (both
// unchanged from Phase 4.12/4.13). OER can block Strong or demote it to
// Promising, but can never independently create High Risk.
// ---------------------------------------------------------------------------

export function deriveOperatingState(oer: MetricClassification): { state: OperatingState; reasons: VerdictReason[] } {
  if (oer.status === "not_applicable") {
    // Removed from required evidence (section 21) — treated as
    // non-blocking, the same "zero positive/negative effect" principle
    // applied to DSCR on a cash purchase.
    return { state: "strong", reasons: [] };
  }
  if (oer.status === "unclassified") {
    return {
      state: "unknown",
      reasons: [{ code: "oer_unclassified", category: "operating", severity: "moderate", metric: "operatingExpenseRatio", classification: oer }],
    };
  }
  if (oer.color === "green") return { state: "strong", reasons: [] };
  if (oer.color === "orange") {
    return {
      state: "acceptable",
      reasons: [{ code: "oer_caution", category: "operating", severity: "moderate", metric: "operatingExpenseRatio", value: null, classification: oer }],
    };
  }
  return {
    state: "weak",
    reasons: [{ code: "high_oer", category: "operating", severity: "high", metric: "operatingExpenseRatio", value: null, classification: oer }],
  };
}

// ---------------------------------------------------------------------------
// Target state (Phase 4.14 sections 31-40) — the PRIMARY overall target
// signal is Equity IRR vs. Required Return, using the RAW comparison
// (IRR >= discountRate), never the provisional ±2pp "Near Target"
// classification margin Phase 4.13 found was not scale-consistent (section
// 32). Equity NPV and Cash-on-Cash Post-Tax remain supporting/confirmatory
// only — see buildTargetSupportingReasons.
// ---------------------------------------------------------------------------

export interface DeriveTargetStateParams {
  irrClassification: MetricClassification;
  irr: number;
  discountRate: number;
}

export function deriveTargetState(params: DeriveTargetStateParams): { state: TargetState; reasons: VerdictReason[] } {
  const { irrClassification, irr, discountRate } = params;

  if (irrClassification.status !== "classified" || !isFiniteNumber(irr) || !isFiniteNumber(discountRate)) {
    // not_applicable (e.g. zero/negative initial equity) or unclassified
    // (defensive fallback — discountRate always exists in the live app) —
    // both mean the target genuinely cannot be determined (section 36).
    return {
      state: "unknown",
      reasons: [{ code: "target_unknown", category: "target", severity: "moderate", metric: "irr", classification: irrClassification.status === "classified" ? null : irrClassification }],
    };
  }

  if (irr >= discountRate) {
    return {
      state: "met",
      reasons: [{ code: "target_met", category: "target", severity: "informational", metric: "irr", value: irr, params: { requiredReturn: discountRate } }],
    };
  }
  return {
    state: "missed",
    reasons: [{ code: "target_missed", category: "target", severity: "high", metric: "irr", value: irr, params: { requiredReturn: discountRate } }],
  };
}

/**
 * Equity NPV / Cash-on-Cash Post-Tax as supporting/confirmatory detail only
 * (Phase 4.14 sections 37-38) — included in `reasons` for context, never
 * capable of contradicting the IRR-derived target state (section 37: "do
 * not create IRR target met, NPV says something slightly different →
 * contradictory verdict").
 */
export function buildTargetSupportingReasons(params: { npv: MetricClassification; npvValue: number | null }): VerdictReason[] {
  const { npv, npvValue } = params;
  if (npv.status !== "classified") return [];
  return [{ code: "npv_supporting", category: "target", severity: "informational", metric: "npv", value: npvValue, classification: npv }];
}

/**
 * Cap Rate PP as context only (Phase 4.14 sections 26-27, 56, 69) — zero
 * blocking authority in this release. Always informational, always safe to
 * include alongside any verdict (including Strong — section 59/69 prove a
 * weak Cap Rate PP must not secretly act as a gate).
 */
export function buildPerformanceContextReasons(capRatePP: MetricClassification): VerdictReason[] {
  if (capRatePP.status !== "classified" || capRatePP.color === "green") return [];
  return [{ code: "cap_rate_context", category: "performance", severity: "informational", metric: "capRatePP", value: null, classification: capRatePP }];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface DeriveDealVerdictParams {
  strategyId: string;
  inputs: DealInputs;
  metrics: DealMetrics;
}

function unavailable(reason: VerdictUnavailableReason, reasons: VerdictReason[]): DealVerdictUnavailable {
  return { status: "unavailable", reason, reasons, verdictModelVersion: VERDICT_MODEL_VERSION };
}

function available(
  verdict: VerdictLabel,
  categoryStates: DealVerdictCategoryStates,
  reasons: VerdictReason[],
  blockers: VerdictReason[]
): DealVerdictAvailable {
  return { status: "available", verdict, categoryStates, reasons, blockers, verdictModelVersion: VERDICT_MODEL_VERSION };
}

/**
 * Pure, deterministic, AI-independent (Phase 4.14 section 77). Reads only
 * already-computed `metrics` (from calcAllMetrics) and `inputs` — never
 * recomputes a financial number itself. Callers (the /calculate API route)
 * must always pass server-recomputed metrics; this function has no way to
 * distinguish trustworthy input from client-tampered input, so that
 * guarantee is the caller's responsibility (Phase 4.14 section 78).
 */
export function deriveDealVerdict(params: DeriveDealVerdictParams): DealVerdictResult {
  const { strategyId, inputs, metrics } = params;

  // ---- Step 1: strategy eligibility (section 1-3, 41) -------------------
  if (strategyId === "fix_and_flip") {
    return unavailable("insufficient_calibrated_evidence", [
      { code: "flip_calibration_incomplete", category: "availability", severity: "informational", params: { strategyId } },
    ]);
  }
  if (strategyId === "instalment_sale") {
    return unavailable("strategy_model_incomplete", [
      { code: "instalment_sale_model_incomplete", category: "availability", severity: "informational", params: { strategyId } },
    ]);
  }
  if (!VERDICT_ENABLED_STRATEGIES.has(strategyId)) {
    return unavailable("strategy_model_incomplete", [
      { code: "strategy_not_verdict_ready", category: "availability", severity: "informational", params: { strategyId } },
    ]);
  }

  const applicabilityCtx: ApplicabilityContext = applicabilityContextFromInputs(inputs);

  const dscrClassification = classifyMetricForDeal("dscr", metrics.dscr, applicabilityCtx, strategyId);
  const breakEvenClassification = classifyMetricForDeal("breakEvenRatio", metrics.breakEvenRatio, applicabilityCtx, strategyId);
  const ltvClassification = classifyMetricForDeal("ltv", metrics.ltv, applicabilityCtx, strategyId);
  const oerClassification = classifyMetricForDeal("operatingExpenseRatio", metrics.operatingExpenseRatio, applicabilityCtx, strategyId);
  const irrClassification = classifyMetricForDeal("irr", metrics.irr, applicabilityCtx, strategyId);
  const npvClassification = classifyMetricForDeal("npv", metrics.npv, applicabilityCtx, strategyId);
  const capRatePPClassification = classifyMetricForDeal("capRatePP", metrics.capRatePP, applicabilityCtx, strategyId);

  const performanceReasons = buildPerformanceContextReasons(capRatePPClassification);
  const hasDebt = isFiniteNumber(metrics.annualDebtService) && metrics.annualDebtService > 0;

  // ---- Step 2: structural High Risk (section 16, 41 Step 2) -------------
  const structural = checkStructuralSafetyFailure({
    dscr: metrics.dscr,
    hasDebt,
    breakEvenRatio: metrics.breakEvenRatio,
    cashflowAnnualPreTax: metrics.cashflowAnnualPreTax,
  });
  if (structural.failed) {
    const { state: operating } = deriveOperatingState(oerClassification);
    const { state: target } = deriveTargetState({ irrClassification, irr: metrics.irr, discountRate: inputs.discountRate });
    const blockingReasons = structural.reasons.filter((r) => r.severity === "blocking");
    return available(
      "high_risk",
      { safety: "weak", operating, target },
      [...structural.reasons, ...performanceReasons],
      blockingReasons
    );
  }

  // ---- Step 3: Safety state (section 41 Step 3, 18-20) ------------------
  const { state: safety, reasons: safetyReasons } = deriveSafetyState({
    dscr: dscrClassification,
    breakEven: breakEvenClassification,
    ltv: ltvClassification,
  });

  // ---- Step 4: Target state (section 41 Step 4, 34-36) -------------------
  const { state: target, reasons: targetReasons } = deriveTargetState({
    irrClassification,
    irr: metrics.irr,
    discountRate: inputs.discountRate,
  });
  const targetSupportingReasons = buildTargetSupportingReasons({ npv: npvClassification, npvValue: isFiniteNumber(metrics.npv) ? metrics.npv : null });

  const { state: operating, reasons: operatingReasons } = deriveOperatingState(oerClassification);

  // ---- Step 5: target missed → Does Not Meet Target (section 41 Step 5) -
  if ((safety === "strong" || safety === "acceptable") && target === "missed") {
    const targetMissedReason = targetReasons.find((r) => r.code === "target_missed")!;
    return available(
      "does_not_meet_target",
      { safety, operating, target },
      [...safetyReasons, ...targetReasons, ...targetSupportingReasons, ...operatingReasons, ...performanceReasons],
      [targetMissedReason]
    );
  }

  // Genuinely insufficient evidence for ANY normal verdict — both primary
  // categories unresolved (section 72: "use this only when genuinely
  // necessary"). Not triggered merely because one category is unknown.
  if (safety === "unknown" && target === "unknown") {
    return unavailable("insufficient_required_inputs", [...safetyReasons, ...targetReasons, ...operatingReasons]);
  }

  // ---- Step 6: Strong qualification (section 41 Step 6, 18) -------------
  if (safety === "strong" && target === "met" && operating === "strong") {
    return available(
      "strong",
      { safety, operating, target },
      [...safetyReasons, ...targetReasons, ...targetSupportingReasons, ...operatingReasons, ...performanceReasons],
      []
    );
  }
  // OER "acceptable" (Caution) does not itself have Strong-blocking
  // authority stronger than "block Strong" (section 23) — but Strong
  // explicitly requires OER not be Weak AND no required PRIMARY evidence
  // missing/unclassified (section 41 Step 6), so acceptable OER also blocks
  // Strong, same as the weak/unknown cases — all three fall through to
  // Promising below, distinguished only by their reasons.

  // ---- Step 7: everything else with sufficient evidence → Promising -----
  const blockers: VerdictReason[] = [
    ...safetyReasons.filter((r) => r.severity === "moderate" || r.severity === "high"),
    ...operatingReasons.filter((r) => r.severity === "moderate" || r.severity === "high"),
    ...targetReasons.filter((r) => r.code === "target_unknown"),
  ];
  return available(
    "promising",
    { safety, operating, target },
    [...safetyReasons, ...targetReasons, ...targetSupportingReasons, ...operatingReasons, ...performanceReasons],
    blockers
  );
}
