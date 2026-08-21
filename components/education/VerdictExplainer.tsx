"use client";

import { getVerdictLabelCopy } from "@/lib/education/verdictCopy";
import type { VerdictLabel } from "@/lib/calculations/verdict";

const RENTAL_LABEL_ORDER: VerdictLabel[] = ["strong", "promising", "promising_if_negotiated", "high_risk", "does_not_meet_target"];
// Fix & Flip never returns "promising_if_negotiated" (acquisition-price
// negotiation for this strategy doesn't exist yet) — omitted here rather
// than explained as reachable, matching the Deal Coach guardrail.
const FLIP_LABEL_ORDER: VerdictLabel[] = ["strong", "promising", "does_not_meet_target", "high_risk"];

interface VerdictExplainerProps {
  strategyId?: string;
}

/**
 * Phase 4.14 section 94-95 (Phase 4.20: strategy-aware) — teaches the
 * verdict hierarchy without exposing every internal rule as marketing copy.
 * Content is data-driven from getVerdictLabelCopy (lib/education/verdictCopy.ts)
 * — the same source the verdict card and PDF read from, so this can never
 * drift out of sync with what the labels actually mean.
 */
export default function VerdictExplainer({ strategyId }: VerdictExplainerProps) {
  const isFlip = strategyId === "fix_and_flip";
  const labelOrder = isFlip ? FLIP_LABEL_ORDER : RENTAL_LABEL_ORDER;

  return (
    <div className="font-body text-sm text-av-slate flex flex-col gap-4">
      {isFlip ? (
        <>
          <p>
            AssetVerdict first checks whether the Base case is estimated to lose money before tax, then whether it
            meets your Required Return. Only then does it check whether a recorded post-renovation valuation still
            leaves the project profitable at its lower confidence bound — that downside check is what separates
            Promising from Strong.
          </p>
          <p>
            The verdict is based on the Base case only, using your own Expected Sale Price and Required Return. It
            is Pre-Tax, and it does not model renovation cost overruns, construction delays, or non-standard
            financing structures (bridge, interest-only, balloon) — see the Exit-Value Evidence section for the
            recorded valuation this verdict draws on.
          </p>
        </>
      ) : (
        <>
          <p>
            AssetVerdict first checks financial safety, then whether the deal meets your Required Return. Operating
            efficiency can prevent the highest verdict, but attractive returns cannot hide a serious safety problem.
          </p>
          <p>
            The verdict is based on the Base case only. Bear and Bull scenarios remain supporting context and do not
            currently change it — and the Bear case does not model financing-rate risk, so it isn&apos;t a full
            downside stress test.
          </p>
        </>
      )}
      <div className="flex flex-col gap-3">
        {labelOrder.map((label) => {
          const copy = getVerdictLabelCopy(label, strategyId);
          return (
            <div key={label} className="rounded-md border border-av-light-grey p-3">
              <p className="font-body text-sm font-semibold text-av-navy mb-1">{copy.title}</p>
              <p className="font-body text-xs text-av-slate">{copy.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
