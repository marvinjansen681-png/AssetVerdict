import type { PropertyValuation, SuburbProfile } from "@/types";
import type { ExitSummary } from "@/lib/calculations";
import type { StrategyId } from "@/lib/strategies";
import { hasMeaningfulPropertyValuation } from "@/lib/propertyValuation";

const STRATEGIES_WITH_FALLBACK_RISK: StrategyId[] = ["str", "multi_let", "student"];

/**
 * Whether FallbackAnalysisCard would render anything for this strategy. For
 * these three strategies the card always renders something — either a real
 * fallback estimate or a "link a suburb profile" prompt — so eligibility is
 * strategy-based, not data-based.
 */
export function hasFallbackAnalysisContent(strategyId: StrategyId): boolean {
  return STRATEGIES_WITH_FALLBACK_RISK.includes(strategyId);
}

/**
 * Whether ExitAnalysisCard would render anything, mirroring its own
 * early-return condition exactly. A PropertyValuation row can exist as an
 * empty stub (every field null) — hasMeaningfulPropertyValuation is what
 * distinguishes that from real evidence. exitSummary is independent of
 * valuation evidence — it's the deal's own deterministic assumptions — so it
 * must count on its own.
 */
export function hasExitAnalysisContent(params: {
  propertyValuation: PropertyValuation | null;
  suburbProfile: SuburbProfile | null;
  exitSummary?: ExitSummary;
}): boolean {
  const hasValuationEvidence =
    hasMeaningfulPropertyValuation(params.propertyValuation) || !!params.suburbProfile;
  return hasValuationEvidence || !!params.exitSummary;
}
