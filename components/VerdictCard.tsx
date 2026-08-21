"use client";

import type { DealVerdictResult, VerdictLabel } from "@/lib/calculations/verdict";
import { getVerdictLabelCopy, VERDICT_UNAVAILABLE_COPY, formatVerdictReason } from "@/lib/education/verdictCopy";
import clsx from "clsx";

interface VerdictCardProps {
  verdict: DealVerdictResult;
  currency?: string;
  strategyId?: string;
}

/**
 * Colour follows the app's existing red/orange/green judgement palette only
 * where a verdict genuinely means that judgement (Strong=green, High
 * Risk=red). "Does Not Meet Target" deliberately does NOT reuse the same
 * red/orange used for per-metric Weak/Caution — Phase 4.14 section 81/93
 * requires it to visually read as fundamentally different from High Risk,
 * not just a lighter shade of danger.
 */
const VERDICT_STYLES: Record<VerdictLabel, { border: string; bg: string; text: string; dot: string }> = {
  strong: { border: "border-av-green", bg: "bg-av-green/10", text: "text-av-green", dot: "bg-av-green" },
  promising: { border: "border-av-gold", bg: "bg-av-gold/10", text: "text-av-gold", dot: "bg-av-gold" },
  promising_if_negotiated: { border: "border-av-gold", bg: "bg-av-gold/10", text: "text-av-gold", dot: "bg-av-gold" },
  high_risk: { border: "border-av-red", bg: "bg-av-red/10", text: "text-av-red", dot: "bg-av-red" },
  does_not_meet_target: { border: "border-av-navy", bg: "bg-av-navy/5", text: "text-av-navy", dot: "bg-av-navy" },
};

export default function VerdictCard({ verdict, currency = "R", strategyId }: VerdictCardProps) {
  if (verdict.status === "unavailable") {
    const copy = VERDICT_UNAVAILABLE_COPY[verdict.reason];
    return (
      <div className="rounded-lg border border-av-light-grey p-5 bg-av-light-grey/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-av-slate/50" aria-hidden />
          <h3 className="font-display text-lg text-av-navy">Overall Verdict</h3>
        </div>
        <p className="font-body text-sm font-semibold text-av-slate mb-1">{copy.title}</p>
        <p className="font-body text-xs text-av-slate">{copy.description}</p>
      </div>
    );
  }

  const copy = getVerdictLabelCopy(verdict.verdict, strategyId);
  const style = VERDICT_STYLES[verdict.verdict];
  // Fix & Flip's reason set is small and fully curated by flipVerdict.ts —
  // every entry (Base Profit, target comparison, Conservative Case result)
  // is meaningful, so informational-severity reasons are shown too (Phase
  // 4.20 section 65 — a clean Strong verdict must still show its concise
  // supporting facts, not an empty card). Rental's reason set stays
  // filtered to blocking/high/moderate only, unchanged.
  const isFlip = strategyId === "fix_and_flip";
  const topReasons = (verdict.blockers.length > 0 ? verdict.blockers : verdict.reasons)
    .filter((r) => isFlip || r.severity === "blocking" || r.severity === "high" || r.severity === "moderate")
    .slice(0, isFlip ? 4 : 3);

  return (
    <div className={clsx("rounded-lg border p-5", style.border, style.bg)}>
      <div className="flex items-center gap-2 mb-1">
        <span className={clsx("w-2.5 h-2.5 rounded-full", style.dot)} aria-hidden />
        <h3 className="font-display text-lg text-av-navy">Overall Verdict</h3>
      </div>
      <p className={clsx("font-display text-2xl mb-2", style.text)}>{copy.title}</p>
      <p className="font-body text-sm text-av-slate mb-3">{copy.description}</p>

      {topReasons.length > 0 && (
        <div className="border-t border-av-light-grey/70 pt-3">
          <p className="font-body text-xs font-semibold text-av-navy mb-2 uppercase tracking-wide">Top Reasons</p>
          <ul className="font-body text-xs text-av-slate space-y-1.5 list-disc list-inside">
            {topReasons.map((r, i) => (
              <li key={`${r.code}-${i}`}>{formatVerdictReason(r, currency)}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="font-body text-[11px] text-av-slate/70 mt-3">
        Based on the Base case only, under the assumptions you&apos;ve entered. Bear and Bull
        scenarios remain supporting context and do not currently change this verdict. This is not
        investment advice — it evaluates the model under your assumptions, not the property
        itself.
      </p>
    </div>
  );
}
