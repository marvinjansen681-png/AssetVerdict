"use client";

import { VERDICT_LABEL_COPY } from "@/lib/education/verdictCopy";
import type { VerdictLabel } from "@/lib/calculations/verdict";

const LABEL_ORDER: VerdictLabel[] = ["strong", "promising", "promising_if_negotiated", "high_risk", "does_not_meet_target"];

/**
 * Phase 4.14 section 94-95 — teaches the verdict hierarchy without exposing
 * every internal rule as marketing copy. Content is data-driven from
 * VERDICT_LABEL_COPY (lib/education/verdictCopy.ts) — the same source the
 * verdict card and PDF read from, so this can never drift out of sync with
 * what the labels actually mean.
 */
export default function VerdictExplainer() {
  return (
    <div className="font-body text-sm text-av-slate flex flex-col gap-4">
      <p>
        AssetVerdict first checks financial safety, then whether the deal meets your Required
        Return. Operating efficiency can prevent the highest verdict, but attractive returns
        cannot hide a serious safety problem.
      </p>
      <p>
        The verdict is based on the Base case only. Bear and Bull scenarios remain supporting
        context and do not currently change it — and the Bear case does not model financing-rate
        risk, so it isn&apos;t a full downside stress test.
      </p>
      <p>
        The overall verdict is currently available for Commercial, Buy-to-Let, Multi-Let, Student,
        and STR deals. Fix &amp; Flip and Instalment Sale don&apos;t yet have enough calibrated
        evidence for AssetVerdict to issue one.
      </p>
      <div className="flex flex-col gap-3">
        {LABEL_ORDER.map((label) => (
          <div key={label} className="rounded-md border border-av-light-grey p-3">
            <p className="font-body text-sm font-semibold text-av-navy mb-1">{VERDICT_LABEL_COPY[label].title}</p>
            <p className="font-body text-xs text-av-slate">{VERDICT_LABEL_COPY[label].description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
