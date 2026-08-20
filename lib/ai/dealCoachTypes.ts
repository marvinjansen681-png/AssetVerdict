/**
 * Shared types for the AssetVerdict Deal Coach (Phase 3).
 *
 * These types describe the boundary between the deterministic app and the
 * AI: `DealCoachContext` is the ONLY thing the model ever sees about a deal.
 * It is assembled server-side by lib/ai/buildDealCoachContext.ts from
 * already-calculated values (lib/calculations, lib/education) — never from
 * raw database records, and never from client-supplied numbers.
 */
import type { DealVerdictResult } from "../calculations/verdict";
import type { NegotiationObjective, NegotiationOpportunity } from "../calculations/negotiation";

export type ScenarioKey = "bear" | "base" | "bull";

/**
 * What the user has focused on. Structured, not inferred from UI text — see
 * Phase 3 brief section 9. A metric hand-off from a learning card always
 * produces `{ type: "metric", metricKey }`; anything else is `{ type: "deal" }`.
 */
export type DealCoachSelection = { type: "metric"; metricKey: string } | { type: "deal" };

/**
 * The fixed set of things a user can ask Deal Coach — every quick-action
 * button maps to one of these, and free-text messages default to
 * "general_question" (or "explain_metric" when a metric is selected). This
 * is what drives how much context gets built (section 6 of the brief) —
 * there is no separate "quick action answer engine": buttons just pre-fill
 * `message` and `intent` and go through the same request path as typed
 * questions.
 */
export type DealCoachIntent =
  | "explain_metric"
  | "explain_deal_simple"
  | "identify_risks"
  | "identify_strengths"
  | "list_assumptions_to_verify"
  | "identify_failure_modes"
  | "compare_scenarios"
  | "due_diligence"
  | "teach_deal"
  | "general_question";

export interface DealCoachMessage {
  role: "user" | "assistant";
  content: string;
}

/** A single deal-metric fact as Deal Coach is allowed to know it — never a raw calculation, always the engine's own output plus the registry's own education content. */
export interface DealCoachMetricEntry {
  key: string;
  name: string;
  shortName?: string;
  category: string;
  /** property / financing / investor / flip — see lib/education/metricDefinitions.ts. */
  perspective: string;
  value: number | null;
  formattedValue: string;
  applicable: boolean;
  applicabilityReason?: string;
  /**
   * Explicit classification status (Phase 3.1, section 9) — the coach must
   * be able to tell "AssetVerdict judged this Caution" apart from
   * "AssetVerdict has no calibrated benchmark for this metric at all."
   * Undefined only when `applicable` is false (not_applicable is already
   * conveyed by `applicable`/`applicabilityReason`).
   *
   * `category` (Phase 4.1, Decision 16) tells the coach WHY a metric is
   * being judged — financial safety, operating quality, property
   * performance, or investor target — so it can never present an
   * investor-target result as proof of financial safety or vice versa (see
   * the system-prompt guardrail in dealCoachPrompt.ts). `label` uses one of
   * two vocabularies depending on `model`: fixed-bands metrics keep
   * Strong/Caution/Weak; target-/zero-relative metrics (Equity IRR, Equity
   * NPV, Cash-on-Cash) use Exceeds/Near/Below Target instead, since those
   * are judged against the investor's own goal, not an absolute standard.
   */
  classification?:
    | {
        status: "classified";
        label: "Strong" | "Caution" | "Weak" | "Exceeds Target" | "Near Target" | "Below Target";
        provisional: boolean;
        category: "financial_safety" | "operating_quality" | "property_performance" | "investor_target" | "strategy_specific";
        model: "fixed_bands" | "target_relative" | "zero_relative";
      }
    | { status: "unclassified"; provisional?: undefined; category?: string; reason?: string };
  /**
   * Only present for target_relative/zero_relative metrics — the exact
   * number the classification above was compared against, so the coach can
   * say "your IRR of 21% vs. your required return of 18%" instead of
   * describing the comparison in the abstract.
   */
  targetContext?: { requiredReturn: number };
  /**
   * Only present for Equity IRR — AssetVerdict's previous strategy-specific
   * fixed bands, retained solely as secondary reference context (Decision
   * 1/6). Never the primary judgement; the coach must present this as
   * "AssetVerdict reference," clearly distinct from the target comparison.
   */
  secondaryReference?: { label: "reference range"; withinRange: boolean; classificationLabel: "Strong" | "Caution" | "Weak"; provisional: true };
  simpleExplanation: string;
  whyItMatters?: string;
  /** Only populated for a single selected metric or a small "closely related" set — never for every metric in a broad context, to keep payloads bounded. */
  breakdown?: {
    formula: string;
    lines: { label: string; value: string }[];
    result: string;
  };
  interpretation?: string;
  /** Human labels, already resolved — never raw registry keys. */
  affectedBy?: string[];
  affects?: string[];
}

/**
 * One objective's negotiation result, pre-formatted for the coach (Phase
 * 4.15) — same "already computed, never yours to recompute" boundary as
 * DealCoachMetricEntry. `explanation` is the SAME sentence the Summary UI
 * shows (lib/education/negotiationCopy.ts), so the coach can never drift
 * from what the user already sees on screen.
 */
export interface DealCoachNegotiationObjective {
  objective: NegotiationObjective;
  label: string;
  status: "already_meets" | "solvable" | "not_achievable_by_price" | "unavailable";
  /** Only present for already_meets/solvable. */
  targetPrice?: string;
  /** Only present for solvable. */
  reductionRand?: string;
  reductionPercent?: string;
  explanation: string;
}

/**
 * The conditional Negotiation Opportunity status, pre-formatted (Phase
 * 4.16) — a SEPARATE fact from the deal's current-asking-price `verdict`
 * (DealCoachContext.verdict), never a replacement for it. `status` mirrors
 * NegotiationOpportunity's own discriminant exactly so the coach can quote
 * it verbatim ("AssetVerdict marks the negotiation opportunity as Promising
 * If Negotiated"). `disclaimer` is ALWAYS present when status is
 * "promising_if_negotiated" and must accompany every mention of it — see
 * the guardrail in dealCoachPrompt.ts.
 */
export interface DealCoachNegotiationOpportunity {
  status: NegotiationOpportunity["status"];
  title: string;
  description: string;
  /** Only present when status is "promising_if_negotiated". */
  targetPrice?: string;
  reductionRand?: string;
  reductionPercent?: string;
  resultingVerdict?: "strong";
  disclaimer?: string;
}

/** One Fix & Flip exit-value scenario (Base/Valuation Point/Conservative), pre-formatted (Phase 4.19) — every field is a direct read of a real calcFixFlipAnalysis() result, never independently computed. */
export interface FlipExitValueScenarioSummaryCopy {
  salePrice: string;
  sameAsBase: boolean;
  estimatedProfitBeforeTax: string;
  preTaxProjectROI: string;
  equityIRR?: string;
  salePriceBufferRand?: string;
  salePriceBufferPercent?: string;
  targetState: "met" | "missed" | "unknown";
}

/** Compact, pre-formatted negotiation/target-purchase-price summary (Phase 4.15/4.16) — never present for Fix & Flip/Instalment Sale in a way that implies a target price exists. */
export interface DealCoachNegotiation {
  currentPrice: string;
  fixedLtvNote: string;
  objectives: DealCoachNegotiationObjective[];
  opportunity: DealCoachNegotiationOpportunity;
}

export interface DealCoachContext {
  deal: {
    name: string;
    strategyId: string;
    strategyLabel: string;
    currency: string;
    address?: string | null;
    /**
     * The hold period Equity IRR/NPV are computed over, and whether it comes
     * from the deal's own planned-sale assumption or AssetVerdict's 20-year
     * analysis-horizon default (see calcExitSummary in lib/calculations).
     * Undefined for Fix & Flip, which has no hold period/IRR/NPV concept.
     */
    holdPeriod?: { years: number; isPlannedSale: boolean };
    /**
     * The deal's own area-based rent estimate (lib/area-suggestions.ts,
     * calcRentSuggestion) — only present when a suburb profile is linked AND
     * the strategy-specific estimate actually resolved to a real number.
     * `basisLabel` names the capacity concept driving it verbatim (e.g.
     * "Per-Bed Aggregate Estimate" for Student, "Per-Room Aggregate Estimate"
     * for Multi-Let) so the coach can never call beds "units" or "rooms".
     * Never populated from an invented figure — absent, not guessed, when no
     * suburb profile is linked or the deal's own rent assumption isn't set.
     */
    areaRentContext?: {
      basisLabel: string;
      estimate: number;
      yourAssumption: number | null;
      fallbackRangeLow: number | null;
      fallbackRangeHigh: number | null;
    };
    /**
     * Commercial only (Phase 4.7) — a factual contract input, not a safety
     * classification. `leaseTermMonths: null` means "not recorded," never
     * "0 months remaining." Undefined entirely for every non-Commercial
     * strategy, so the coach never mentions lease term outside Commercial.
     */
    commercialContext?: { leaseTermMonths: number | null };
  };
  /**
   * Fix & Flip only (Phase 4.17) — the ONE deterministic Fix & Flip
   * financial model (lib/calculations/fixFlip.ts), pre-formatted. Undefined
   * for every non-Flip strategy. All figures are already-computed,
   * already-formatted strings; the coach must never recompute or
   * re-derive any of them (see the guardrail in dealCoachPrompt.ts).
   * `status: "unavailable"` means holdingPeriodMonths is invalid — every
   * other field is then absent, and the coach should say so plainly rather
   * than guessing a duration.
   */
  fixFlipAnalysis?: {
    status: "available" | "unavailable";
    holdingPeriodMonths?: number;
    purchasePrice?: string;
    acquisitionCosts?: string;
    renovationCost?: string;
    totalHoldingCosts?: string;
    totalLoanAmount?: string;
    totalInterestPaid?: string;
    totalPrincipalPaid?: string;
    remainingLoanBalanceAtSale?: string;
    projectedSalePrice?: string;
    sellingCosts?: string;
    projectProfitBeforeFinancingAndTax?: string;
    estimatedProfitBeforeTax?: string;
    preTaxProjectROI?: string;
    preTaxEquityROI?: string;
    annualisedPreTaxROI?: string;
    equityIRR?: string;
    preTaxProfitMargin?: string;
    breakEvenSalePrice?: string;
    salePriceBufferRand?: string;
    salePriceBufferPercent?: string;
    financingAssumption?: string;
    taxAssumption?: string;
    renovationTimingAssumption?: string;
  };
  /**
   * Fix & Flip only (Phase 4.19) — the deterministic exit-value evidence
   * and scenario model (lib/calculations/fixFlipExitValue.ts), pre-formatted.
   * Undefined for every non-Flip strategy. Every scenario figure here comes
   * from re-running the SAME calcFixFlipAnalysis engine at an evidence-backed
   * sale price — the coach must never invent its own haircut, compute a
   * different conservative price, or judge whether Expected Sale Price is
   * "realistic" (see the guardrail in dealCoachPrompt.ts). This is evidence
   * and scenario comparison only — it is not a Fix & Flip verdict, and does
   * not make one available.
   */
  fixFlipExitValueAnalysis?: {
    status: "available" | "unavailable";
    expectedSalePrice?: string;
    evidenceStatus?: "no_numeric_valuation" | "point_estimate_only" | "lower_bound_only" | "valuation_range_available" | "invalid_valuation";
    /**
     * Phase 4.19.1 — whether the recorded valuation is known to reflect
     * current condition, post-renovation condition, or neither. Always
     * "unknown" today (PropertyValuation has no such field, and this is
     * never inferred) — the coach must treat any valuation figure as
     * supporting evidence only, never as confirmed post-renovation exit
     * value, and must say so plainly if asked (see the guardrail in
     * dealCoachPrompt.ts).
     */
    valuationBasis?: "unknown";
    reportSource?: string;
    reportDate?: string;
    valuationAgeDays?: number;
    recordedEstimate?: string;
    recordedRangeLow?: string;
    recordedRangeHigh?: string;
    rangePosition?: "below_range" | "within_range" | "above_range";
    expectedVsEstimate?: string;
    valuationConfidenceLabel?: string;
    comparableCount?: number;
    /** Present only when a usable point estimate exists (never above Expected Sale Price). */
    valuationPointCase?: FlipExitValueScenarioSummaryCopy;
    /** Present only when a usable lower confidence bound exists (never above Expected Sale Price, never an invented percentage). */
    conservativeCase?: FlipExitValueScenarioSummaryCopy & {
      survivesConservativeCase: boolean;
      meetsRequiredReturnInConservativeCase: boolean | null;
    };
  };
  scenario: {
    active: ScenarioKey;
    note: string;
  };
  /** The bounded set of metrics relevant to this request — see buildDealCoachContext.ts for how breadth is chosen per intent. */
  metrics: DealCoachMetricEntry[];
  /** Only present for intent "compare_scenarios": headline metrics per scenario, not full 20-year projections. */
  scenarioComparison?: Record<ScenarioKey, Record<string, string>>;
  /**
   * The deterministic overall verdict (Phase 4.14) — ALWAYS computed from
   * the Base case, regardless of `scenario.active` (section 97: Bear/Bull
   * never drive the verdict). The coach must treat this as authoritative
   * application output: explain it, never recompute, override, soften, or
   * intensify it (see the guardrail in dealCoachPrompt.ts). Present for
   * every request — its own `status` field already distinguishes an
   * available verdict from a strategy that doesn't get one yet.
   */
  verdict: DealVerdictResult;
  /**
   * Deterministic target-purchase-price analysis (Phase 4.15) — ALWAYS
   * computed from the Base case, same rule as `verdict`. Undefined only when
   * negotiation analysis genuinely can't be built for this request (e.g. an
   * invalid purchase price); for unsupported strategies (Fix & Flip,
   * Instalment Sale) this is still present with every objective's own
   * status "unavailable", so the coach can explain why rather than staying
   * silent about it.
   */
  negotiation?: DealCoachNegotiation;
  /** Deterministic, rule-based flags (e.g. "occupancy assumed at 100%") — the engine identifies WHAT is assumption-heavy; the AI turns that into due-diligence questions, never the reverse. */
  assumptionFlags?: { field: string; value: string; note: string }[];
  selection: DealCoachSelection;
}

export interface DealCoachRequestBody {
  message: string;
  intent?: DealCoachIntent;
  selectedMetric?: string;
  activeScenario?: ScenarioKey;
  conversation?: DealCoachMessage[];
}

export interface DealCoachResponse {
  answer: string;
  referencedMetrics?: string[];
  suggestedFollowUps?: string[];
}
