/**
 * Plain-English copy for the deterministic Negotiation & Target Purchase
 * Price engine (Phase 4.15).
 *
 * Mirrors verdictCopy.ts exactly: this module computes and judges NOTHING —
 * it only turns lib/calculations/negotiation.ts's structured reasonCode/
 * blockers output into the exact wording the Phase 4.15 brief specified, so
 * the Summary UI, PDF, and Deal Coach context all render identical language
 * from one place. AI copy (Deal Coach) reads this same text; it never
 * generates its own explanation of a negotiation result.
 *
 * Section 58: never label a target price "Recommended Offer," "Fair Offer,"
 * or similar — every string in this file says "Target Purchase Price" /
 * "Maximum Price to..." instead, because AssetVerdict is solving a
 * mathematical objective, not predicting what a seller will accept.
 */
import { formatMetricValue } from "./format";
import { formatVerdictReason } from "./verdictCopy";
import type {
  NegotiationObjective,
  NegotiationTargetResult,
  NegotiationUnavailableReason,
  NegotiationOpportunity,
} from "../calculations/negotiation";

export const NEGOTIATION_OBJECTIVE_LABEL: Record<NegotiationObjective, string> = {
  meet_required_return: "Price to Meet Your Required Return",
  clear_structural_safety: "Price to Clear Structural Safety",
  reach_promising: "Price to Reach Promising or Better",
  reach_strong: "Price to Reach Strong",
};

export const NEGOTIATION_OBJECTIVE_SHORT_LABEL: Record<NegotiationObjective, string> = {
  meet_required_return: "Required Return",
  clear_structural_safety: "Structural Safety",
  reach_promising: "Promising",
  reach_strong: "Strong",
};

/** Verb-phrase form for sentences like "no discount is required to ___" — grammatical, unlike the short label alone. */
export const NEGOTIATION_OBJECTIVE_VERB_PHRASE: Record<NegotiationObjective, string> = {
  meet_required_return: "meet your required return",
  clear_structural_safety: "clear structural safety",
  reach_promising: "reach Promising or better",
  reach_strong: "reach Strong",
};

export const NEGOTIATION_UNAVAILABLE_COPY: Record<NegotiationUnavailableReason, string> = {
  strategy_not_supported: "Negotiation analysis is not yet available for this strategy.",
  invalid_purchase_price: "Negotiation analysis needs a valid purchase price before it can run.",
  insufficient_inputs: "AssetVerdict doesn't have enough deal information yet to run negotiation analysis.",
  unsupported_financing_structure: "Negotiation analysis is not available for this financing structure.",
};

/**
 * Longer supporting sentence for `unsupported_financing_structure` (Phase
 * 4.15.1, section 15) — deliberately frames this as a limitation of the
 * NEGOTIATION MODEL, never a claim that the deal's own financing is invalid.
 * AssetVerdict's ordinary metrics/verdict still work normally for such a
 * deal; only target-price analysis is withheld.
 */
export const UNSUPPORTED_FINANCING_STRUCTURE_EXPLAINER =
  "Current acquisition finance exceeds the purchase price. AssetVerdict's current target-price model assumes a standard loan-to-price structure and does not analyse over-100% financing. This does not mean your financing is invalid — it may be intentionally structured that way — AssetVerdict simply doesn't yet calculate negotiation targets for it.";

/**
 * One-line summary for a single objective's result — the primary string the
 * Negotiation Analysis card and PDF render per row.
 */
export function describeNegotiationResult(result: NegotiationTargetResult, currency = "R"): string {
  switch (result.status) {
    case "already_meets":
      return "Already achieved at the asking price — no discount required.";
    case "solvable": {
      const price = formatMetricValue(result.targetPrice, "currency", currency);
      const reduction = formatMetricValue(result.reductionRand, "currency", currency);
      return `${price} (a reduction of ${reduction}, ${result.reductionPercent.toFixed(1)}%).`;
    }
    case "not_achievable_by_price": {
      const verbPhrase = NEGOTIATION_OBJECTIVE_VERB_PHRASE[result.objective];
      const capitalised = verbPhrase.charAt(0).toUpperCase() + verbPhrase.slice(1);
      if (result.blockers.length === 0) {
        return `${capitalised} is not achievable through purchase-price negotiation alone, even at a much lower purchase price.`;
      }
      const blockerText = result.blockers.map((b) => formatVerdictReason(b, currency)).join(" ");
      return `${capitalised} is not achievable through purchase-price negotiation alone, even at a much lower purchase price. ${blockerText}`;
    }
    case "unavailable":
      return NEGOTIATION_UNAVAILABLE_COPY[result.reason];
  }
}

/**
 * Extra context sentence appended when a Strong/Promising objective is
 * blocked by something the fixed-LTV policy structurally can't clear
 * (Phase 4.15 section 44-45) — surfaced separately from the generic blocker
 * text so the UI can call out the mechanism, not just the symptom.
 */
export function describeFixedLtvLimitation(result: NegotiationTargetResult): string | null {
  if (result.status !== "not_achievable_by_price") return null;
  if (!result.blockers.some((b) => b.code === "high_ltv")) return null;
  return "Your Loan-to-Value ratio is part of this blocker. AssetVerdict preserves your original loan-to-price ratio when negotiating price, so a lower purchase price does not reduce your LTV percentage — see \"How negotiation pricing works\" below.";
}

/** Section 59 — the standing "what does this mean" explainer. */
export const TARGET_PRICE_EXPLAINER =
  "AssetVerdict recalculates this deal at lower purchase prices and finds the highest price that still satisfies the selected financial condition. It does not predict whether a seller will accept that price.";

/** Section 60 — the fixed-LTV financing assumption, always shown alongside any target price. */
export const FIXED_LTV_ASSUMPTION_EXPLAINER =
  "For negotiation analysis, AssetVerdict currently assumes your financing scales with the purchase price so your original loan-to-price ratio (LTV) stays unchanged. Interest rates and loan terms stay the same. This means a lower purchase price reduces your Rand loan amount and debt service, but does NOT reduce your LTV percentage itself.";

/** Section 56 — "already meets" framing, distinct from a R0 target. */
export function describeAlreadyMeets(objective: NegotiationObjective, currentPrice: number, currency = "R"): string {
  return `Already achieved at your current asking price of ${formatMetricValue(currentPrice, "currency", currency)} — no discount is required to ${NEGOTIATION_OBJECTIVE_VERB_PHRASE[objective]}.`;
}

// ---------------------------------------------------------------------------
// Conditional Negotiation Opportunity copy (Phase 4.16).
//
// This is the ONLY place `promising_if_negotiated`-related prose is
// authored — the calculation layer (lib/calculations/negotiation.ts) emits
// only stable status/reasonCode values, never a sentence. Every string here
// deliberately avoids any claim about seller acceptance, negotiation
// realism, or discount plausibility (Phase 4.16 sections 2, 15-19) — see
// NEGOTIATION_OPPORTUNITY_DISCLAIMER, which must accompany every
// "promising_if_negotiated" display.
// ---------------------------------------------------------------------------

export const NEGOTIATION_OPPORTUNITY_TITLE: Record<NegotiationOpportunity["status"], string> = {
  promising_if_negotiated: "Promising If Negotiated",
  already_strong: "Already Strong",
  no_negotiation_opportunity: "No Conditional Opportunity",
  unavailable: "Not Available",
};

/**
 * The primary descriptive sentence for a NegotiationOpportunity result.
 * Section 28's recommended wording for the qualifying case; structured,
 * reused reasons for every non-qualifying case — never invented prose about
 * WHY price can't help beyond what the engine's own blockers already say.
 */
export function describeNegotiationOpportunity(opportunity: NegotiationOpportunity, currency = "R"): string {
  switch (opportunity.status) {
    case "promising_if_negotiated":
      return "A lower purchase price can move this deal into AssetVerdict's Strong range under the same Base-case assumptions.";
    case "already_strong":
      return "This deal already meets AssetVerdict's current Strong conditions at the asking price, so no conditional negotiation label is needed.";
    case "no_negotiation_opportunity":
      if (opportunity.reasonCode === "current_high_risk") {
        return "AssetVerdict keeps the current High Risk verdict because a structural safety failure exists at the asking price. Negotiation targets remain available separately, below.";
      }
      if (opportunity.reasonCode === "strong_not_reachable_by_price") {
        const blockerText =
          opportunity.blockers && opportunity.blockers.length > 0
            ? opportunity.blockers.map((b) => formatVerdictReason(b, currency)).join(" ")
            : "AssetVerdict's evidence remains insufficient even at a much lower purchase price.";
        return `Purchase-price negotiation alone cannot make this deal Strong. ${blockerText}`;
      }
      // Defensive fallbacks (target_price_not_lower / resulting_verdict_not_strong)
      // — structurally shouldn't occur; see deriveNegotiationOpportunity's doc comment.
      return "AssetVerdict could not confirm a conditional negotiation opportunity for this deal.";
    case "unavailable":
      return opportunity.reason === "current_verdict_unavailable"
        ? "AssetVerdict does not currently issue an overall verdict for this deal, so no conditional negotiation opportunity can be determined."
        : NEGOTIATION_UNAVAILABLE_COPY[opportunity.reason];
  }
}

/**
 * Mandatory companion sentence (sections 2, 15-19, 28) — MUST be shown
 * alongside every "promising_if_negotiated" display, in the UI, PDF, and
 * Deal Coach alike. Never omit it, never soften it, never replace it with a
 * plausibility judgement.
 */
export const NEGOTIATION_OPPORTUNITY_DISCLAIMER =
  "This is a mathematical target, not a prediction that the seller will accept the required price. AssetVerdict does not model seller acceptance, negotiation probability, or whether a given reduction is realistic.";
