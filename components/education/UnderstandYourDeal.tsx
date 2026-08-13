import type { DealMetrics } from "@/lib/calculations";
import { applicabilityContextFromMetrics, type ApplicabilityContext } from "@/lib/calculations/applicability";
import { getMetricGroupsForStrategy } from "@/lib/education/metricDefinitions";
import { getRelationshipChainsForStrategy } from "@/lib/education/relationshipChains";
import type { AcquisitionSummary } from "@/lib/education/metricBreakdowns";
import MetricLearningCard from "./MetricLearningCard";
import MetricRelationshipChain from "./MetricRelationshipChain";
import DealMentalModel from "./DealMentalModel";

interface UnderstandYourDealProps {
  metrics: DealMetrics;
  dealSummary: AcquisitionSummary;
  strategyId: string;
  currency?: string;
  /** When supplied, each card renders an "Ask Deal Coach about this" action that hands the metric key off to the Deal Coach drawer (Phase 3). */
  onAskCoach?: (metricKey: string) => void;
}

/**
 * The full "Understand Your Deal" education experience for one deal (Phase
 * 2): a mental-model overview, a couple of curated relationship chains, then
 * every metric relevant to this strategy — grouped exactly the way
 * lib/education/metricDefinitions.ts already groups them, so a fix-and-flip
 * deal only ever sees flip education and a rental deal never sees ROI/
 * Annualised ROI. This component computes nothing: every number it displays
 * comes from `metrics`, already produced by the deterministic engine.
 */
export default function UnderstandYourDeal({
  metrics,
  dealSummary,
  strategyId,
  currency = "R",
  onAskCoach,
}: UnderstandYourDealProps) {
  const groups = getMetricGroupsForStrategy(strategyId);
  const chains = getRelationshipChainsForStrategy(strategyId);

  const applicabilityCtx: ApplicabilityContext = {
    ...applicabilityContextFromMetrics(metrics),
    purchasePrice: dealSummary.purchasePrice ?? undefined,
    marketValue: dealSummary.marketValue ?? undefined,
  };

  return (
    <div className="flex flex-col gap-10">
      <DealMentalModel metrics={metrics} strategyId={strategyId} currency={currency} />

      {chains.length > 0 && (
        <div>
          <h3 className="font-display text-lg text-av-navy mb-3">How the Numbers Connect</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {chains.map((chain) => (
              <MetricRelationshipChain key={chain.title} chain={chain} />
            ))}
          </div>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-display text-lg text-av-navy">{group.label}</h3>
            <div className="flex-1 h-[2px] bg-av-gold" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.metricKeys.map((key) => (
              <MetricLearningCard
                key={key}
                metricKey={key}
                metrics={metrics}
                dealSummary={dealSummary}
                strategyId={strategyId}
                applicabilityCtx={applicabilityCtx}
                currency={currency}
                onAskCoach={onAskCoach}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
