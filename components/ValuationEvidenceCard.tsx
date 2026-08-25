"use client";

import type { ValuationSummary } from "@/lib/calculations/valuationEvidence";

interface ValuationEvidenceCardProps {
  /** The engine's own valuation summary (lib/calculations/valuationEvidence.ts) — never recomputed here. */
  summary: ValuationSummary;
}

function fmtCurrency(n: number | null | undefined) {
  return n !== null && n !== undefined
    ? `R ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "N/A";
}

const SOURCE_CATEGORY_LABEL: Record<string, string> = {
  user_estimate: "User Estimate",
  agent_cma: "Estate Agent / CMA",
  avm: "Automated Valuation (AVM)",
  comparable_sales_analysis: "Comparable Sales Analysis",
  independent_valuation: "Independent Professional Valuation",
  bank_valuation: "Bank Valuation",
  other_unknown: "Other / Unrecorded",
};

const BASIS_LABEL: Record<string, string> = {
  current_condition: "Current Condition",
  post_renovation: "Post-Renovation",
  unknown: "Not Recorded",
};

const EVIDENCE_QUALITY_LABEL: Record<string, string> = {
  unverified: "Unverified",
  indicative: "Indicative",
  supported: "Supported",
  strong_evidence: "Strong Evidence",
};

function fmtDate(value: Date | string | null) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function ValuationEvidenceCard({ summary }: ValuationEvidenceCardProps) {
  const hasAnything =
    summary.userEstimatedCurrentMarketValue !== null ||
    summary.evidenceBasedCurrentValue !== null ||
    summary.evidenceBasedPostRenovationValue !== null;
  if (!hasAnything) return null;

  const valuationDate = fmtDate(summary.valuationDate);

  return (
    <div className="rounded-lg border border-av-light-grey p-5">
      <h3 className="font-display text-lg text-av-navy mb-1">Valuation Evidence</h3>
      <p className="text-xs font-body text-av-slate mb-4">
        AssetVerdict distinguishes what YOU think the property is worth from what recorded evidence
        supports — these are never the same thing, and neither silently overrides the other.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-sm">
        <div className="rounded-md bg-av-light-grey/50 p-3">
          <div className="text-xs text-av-slate mb-1">Your Estimate</div>
          <div className="font-mono text-lg text-av-navy">{fmtCurrency(summary.userEstimatedCurrentMarketValue)}</div>
          <div className="text-xs text-av-slate mt-1">Not a bank-confirmed valuation.</div>
        </div>

        <div className="rounded-md bg-av-light-grey/50 p-3">
          <div className="text-xs text-av-slate mb-1">Evidence-Based Current Value</div>
          <div className="font-mono text-lg text-av-navy">{fmtCurrency(summary.evidenceBasedCurrentValue)}</div>
          {summary.evidenceValueLow !== null && summary.evidenceValueHigh !== null && (
            <div className="text-xs text-av-slate mt-1">
              Range: {fmtCurrency(summary.evidenceValueLow)} – {fmtCurrency(summary.evidenceValueHigh)}
            </div>
          )}
        </div>
      </div>

      {summary.variance && (
        <div className="rounded-md border border-av-light-grey p-3 mt-4 font-body text-sm">
          <div className="text-xs font-semibold text-av-navy mb-2">Your Estimate vs. Evidence</div>
          <div className="flex justify-between">
            <span className="text-av-slate">Difference</span>
            <span className="font-mono text-av-navy">
              {summary.variance.differenceRand >= 0 ? "+" : ""}
              {fmtCurrency(summary.variance.differenceRand)} ({summary.variance.differencePercent >= 0 ? "+" : ""}
              {summary.variance.differencePercent.toFixed(1)}%)
            </span>
          </div>
          <p className="text-xs text-av-slate/80 mt-2">
            This disagreement is shown as-is — AssetVerdict does not decide which figure is correct.
          </p>
        </div>
      )}

      {summary.evidenceBasedPostRenovationValue !== null && (
        <div className="rounded-md bg-av-light-grey/50 p-3 mt-4">
          <div className="text-xs text-av-slate mb-1">Evidence-Based Post-Renovation Value</div>
          <div className="font-mono text-lg text-av-navy">{fmtCurrency(summary.evidenceBasedPostRenovationValue)}</div>
          <div className="text-xs text-av-slate mt-1">
            A different concept from current value — never used as a current-value denominator.
          </div>
        </div>
      )}

      {summary.assumedFutureSalePrice !== null && (
        <div className="rounded-md bg-av-light-grey/50 p-3 mt-4">
          <div className="text-xs text-av-slate mb-1">Assumed Future Sale Price</div>
          <div className="font-mono text-lg text-av-navy">{fmtCurrency(summary.assumedFutureSalePrice)}</div>
          <div className="text-xs text-av-slate mt-1">Your own assumption — not evidence of any kind.</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 font-body text-xs">
        <div>
          <div className="text-av-slate">Source</div>
          <div className="text-av-navy font-semibold">
            {summary.valuationSource ? SOURCE_CATEGORY_LABEL[summary.valuationSourceCategory] : "N/A"}
          </div>
        </div>
        <div>
          <div className="text-av-slate">Valuation Basis</div>
          <div className="text-av-navy font-semibold">{BASIS_LABEL[summary.valuationBasis] ?? "Not Recorded"}</div>
        </div>
        <div>
          <div className="text-av-slate">Valuation Date</div>
          <div className="text-av-navy font-semibold">
            {valuationDate ?? "N/A"}
            {summary.valuationAgeDays !== null && ` (${summary.valuationAgeDays}d ago)`}
          </div>
        </div>
        <div>
          <div className="text-av-slate">Evidence Quality</div>
          <div className="text-av-navy font-semibold">{EVIDENCE_QUALITY_LABEL[summary.valuationEvidenceQuality]}</div>
        </div>
      </div>

      <p className="text-xs font-body text-av-slate/80 mt-3">
        Evidence Quality is AssetVerdict&apos;s own internal conceptual scale — not an externally
        validated rating — and currently has no effect on your verdict, Estimated Value LTV, or any
        other calculation.
      </p>
    </div>
  );
}
